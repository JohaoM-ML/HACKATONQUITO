/**
 * Seed: geocodifica los sectores y genera su malla de minizonas.
 *
 * Los sectores salen de los anuncios de corte de Interagua, que dan un nombre de barrio
 * pero ninguna coordenada. En vez de inventar centroides, este script los resuelve con
 * la Geocoding API de Google. Lo que quede sin geocodificar se deja en null para que el
 * jefe lo marque a mano en el mapa: es preferible un hueco visible a un dato inventado.
 *
 * Uso (desde web/):
 *   npx tsx scripts/seed-minizonas.ts [radio_m]
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY y GOOGLE_MAPS_SERVER_KEY (o
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY si la clave no está restringida por referrer).
 */
import { createClient } from "@supabase/supabase-js";
import { CENTROS_PUBLICOS, centroide, mallaDeSector, META_VIVIENDAS_MINIZONA } from "../lib/geo/minizonas";

const RADIO_DEFECTO = Number(process.argv[2]) || 500;

// Caja de Guayaquil: descarta resultados que el geocodificador ubique en otra ciudad.
const CAJA = { latMin: -2.45, latMax: -1.95, lonMin: -80.1, lonMax: -79.7 };

async function geocodificar(nombre: string, key: string) {
  const q = encodeURIComponent(`${nombre}, Guayaquil, Guayas, Ecuador`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== "OK" || !json.results?.length) return null;

  const loc = json.results[0].geometry?.location;
  if (!loc) return null;
  if (
    loc.lat < CAJA.latMin ||
    loc.lat > CAJA.latMax ||
    loc.lng < CAJA.lonMin ||
    loc.lng > CAJA.lonMax
  ) {
    return null;
  }
  return { lat: loc.lat as number, lon: loc.lng as number };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gkey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!gkey) {
    console.warn("Sin clave de Google: se usarán centros públicos aproximados.");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sectores, error } = await supabase
    .from("sectores")
    .select("id, slug, nombre, lat, lon");
  if (error) throw error;

  let geocodificados = 0;
  let sinResolver = 0;
  let celdas = 0;

  for (const s of sectores || []) {
    let punto = s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : null;

    if (!punto) {
      punto = gkey ? await geocodificar(s.nombre, gkey) : null;
      if (!punto) punto = CENTROS_PUBLICOS[s.slug] ?? CENTROS_PUBLICOS[s.nombre] ?? null;
      if (!punto) {
        console.log(`  sin resolver: ${s.nombre} — lo marcará el jefe en el mapa`);
        sinResolver++;
        continue;
      }
      geocodificados++;
    }

    await supabase
      .from("sectores")
      .update({ lat: punto.lat, lon: punto.lon, radio_m: RADIO_DEFECTO })
      .eq("id", s.id);

    const filas = mallaDeSector(punto, RADIO_DEFECTO).map((h3) => {
      const c = centroide(h3);
      return {
        sector_id: s.id,
        h3,
        lat: c.lat,
        lon: c.lon,
        origen: "malla" as const,
        meta_viviendas: META_VIVIENDAS_MINIZONA,
      };
    });

    const { error: mErr } = await supabase
      .from("minizonas")
      .upsert(filas, { onConflict: "h3", ignoreDuplicates: true });
    if (mErr) {
      console.error(`  error en ${s.nombre}: ${mErr.message}`);
      continue;
    }

    celdas += filas.length;
    console.log(`  ${s.nombre}: ${filas.length} minizonas (r=${RADIO_DEFECTO} m)`);
  }

  console.log(
    `\nListo. ${geocodificados} sectores geocodificados, ${sinResolver} sin resolver, ${celdas} minizonas.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
