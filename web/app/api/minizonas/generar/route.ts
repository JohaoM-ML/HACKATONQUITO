import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SECTORES_GUAYAQUIL } from "@/lib/geo/guayaquil";
import {
  centroide,
  mallaDeGuayaquil,
  mallaDeSector,
  META_VIVIENDAS_MINIZONA,
} from "@/lib/geo/minizonas";

/**
 * Delimita un sector (centro + radio) o regenera el panal del casco urbano
 * de Guayaquil (`alcance: "ciudad"`).
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
    return NextResponse.json({ error: "Solo el jefe delimita sectores" }, { status: 403 });
  }

  const body = await req.json();

  if (body.alcance === "ciudad") {
    return generarCiudad(supabase);
  }

  const { sector_id, lat, lon, radio_m } = body;
  if (!sector_id || typeof lat !== "number" || typeof lon !== "number" || !radio_m) {
    return NextResponse.json({ error: "Faltan sector_id, lat, lon o radio_m" }, { status: 400 });
  }
  if (radio_m > 8000) {
    return NextResponse.json({ error: "Radio máximo 8000 m" }, { status: 400 });
  }

  const celdas = mallaDeSector({ lat, lon }, radio_m);

  await supabase.from("sectores").update({ lat, lon, radio_m }).eq("id", sector_id);

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

  const { error } = await supabase
    .from("minizonas")
    .upsert(filas, { onConflict: "h3", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, generadas: filas.length });
}

async function generarCiudad(
  supabase: ReturnType<typeof createClient>
) {
  for (const s of SECTORES_GUAYAQUIL) {
    const { error } = await supabase.from("sectores").upsert(
      {
        slug: s.slug,
        nombre: s.nombre,
        zona: s.zona,
        lat: s.lat,
        lon: s.lon,
        radio_m: 4000,
      },
      { onConflict: "slug" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: sectores, error: sErr } = await supabase
    .from("sectores")
    .select("id, slug");
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

  const idPorSlug = new Map((sectores || []).map((s) => [s.slug, s.id]));

  await supabase.from("visitas").update({ minizona_id: null }).not("minizona_id", "is", null);
  await supabase.from("minizonas").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const filas = mallaDeGuayaquil()
    .map((c) => {
      const sector_id = idPorSlug.get(c.slug);
      if (!sector_id) return null;
      return {
        sector_id,
        h3: c.h3,
        lat: c.lat,
        lon: c.lon,
        origen: "malla" as const,
        meta_viviendas: META_VIVIENDAS_MINIZONA,
      };
    })
    .filter((f): f is NonNullable<typeof f> => !!f);

  const { error } = await supabase.from("minizonas").insert(filas);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, generadas: filas.length, alcance: "ciudad" });
}
