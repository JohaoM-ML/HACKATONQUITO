import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CENTROS_PUBLICOS,
  centroide,
  mallaDeSector,
  META_VIVIENDAS_MINIZONA,
  radioAutomatico,
  type LatLon,
} from "@/lib/geo/minizonas";

// Caja de Guayaquil: descarta resultados que el geocodificador ubique en otra ciudad.
const CAJA = { latMin: -2.45, latMax: -1.95, lonMin: -80.1, lonMax: -79.7 };

async function geocodificar(nombre: string, key: string): Promise<LatLon | null> {
  const q = encodeURIComponent(`${nombre}, Guayaquil, Guayas, Ecuador`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "OK" || !json.results?.length) return null;

  const loc = json.results[0].geometry?.location;
  if (!loc) return null;
  if (loc.lat < CAJA.latMin || loc.lat > CAJA.latMax || loc.lng < CAJA.lonMin || loc.lng > CAJA.lonMax) {
    return null;
  }
  return { lat: loc.lat as number, lon: loc.lng as number };
}

/**
 * Resuelve el centro de un sector sin coordenadas: primero geocodifica el nombre,
 * y si no hay clave o el resultado no cae en Guayaquil, usa el centro público conocido.
 * Si tampoco hay eso, se deja sin resolver — preferible un hueco visible a un dato
 * inventado (mismo criterio que scripts/seed-minizonas.ts).
 */
async function resolverCentro(sector: { slug: string; nombre: string; lat: number | null; lon: number | null }) {
  if (sector.lat != null && sector.lon != null) return { lat: sector.lat, lon: sector.lon };

  const gkey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const geo = gkey ? await geocodificar(sector.nombre, gkey) : null;
  if (geo) return geo;

  return CENTROS_PUBLICOS[sector.slug] ?? CENTROS_PUBLICOS[sector.nombre] ?? null;
}

/**
 * Genera (o completa) la cobertura de un sector: el sistema decide dónde y qué tan
 * grande, a partir del puntaje del motor de reglas (corte + almacenamiento). El jefe
 * ya no marca centro ni radio a mano — solo dispara la generación y supervisa el
 * resultado en el mapa.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  if (perfil?.rol !== "jefe") {
    return NextResponse.json({ error: "Solo el jefe puede disparar la generación" }, { status: 403 });
  }

  const { sector_id } = await req.json();
  if (!sector_id) return NextResponse.json({ error: "Falta sector_id" }, { status: 400 });

  const { data: sector } = await supabase
    .from("sectores")
    .select("id, slug, nombre, lat, lon")
    .eq("id", sector_id)
    .maybeSingle();
  if (!sector) return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 });

  // El puntaje manda: sin regla activa (A/B) no hay nada que priorizar todavía.
  const { data: colaItem } = await supabase
    .from("cola_items")
    .select("regla, puntaje")
    .eq("sector_id", sector_id)
    .not("regla", "is", null)
    .order("puntaje", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!colaItem?.regla) {
    return NextResponse.json(
      { error: "Este sector no tiene prioridad activa en la cola: nada que generar todavía." },
      { status: 400 }
    );
  }

  const centro = await resolverCentro(sector);
  if (!centro) {
    return NextResponse.json(
      {
        error:
          "No se pudo ubicar el sector automáticamente (sin geocodificar y sin centro público conocido). Queda pendiente en vez de inventar coordenadas.",
      },
      { status: 422 }
    );
  }

  const radio_m = radioAutomatico(colaItem.regla, colaItem.puntaje);
  const celdas = mallaDeSector(centro, radio_m);

  await supabase.from("sectores").update({ lat: centro.lat, lon: centro.lon, radio_m }).eq("id", sector_id);

  const filas = celdas.map((h3) => {
    const c = centroide(h3);
    return {
      sector_id,
      h3,
      lat: c.lat,
      lon: c.lon,
      origen: "malla" as const,
      meta_viviendas: META_VIVIENDAS_MINIZONA,
    };
  });

  // h3 es único global: si la celda ya existe (por un cerco previo) se respeta.
  const { error } = await supabase
    .from("minizonas")
    .upsert(filas, { onConflict: "h3", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    generadas: filas.length,
    radio_m,
    regla: colaItem.regla,
    puntaje: colaItem.puntaje,
    centro,
  });
}
