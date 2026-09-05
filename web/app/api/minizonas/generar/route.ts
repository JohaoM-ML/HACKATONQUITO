import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { centroide, mallaDeSector, META_VIVIENDAS_MINIZONA } from "@/lib/geo/minizonas";

/**
 * Delimita un sector: el jefe marca un centro y un radio, y aquí se genera la malla
 * de minizonas que lo cubre. Reemplaza la necesidad de tener polígonos de barrio
 * oficiales, que en Guayaquil no están publicados.
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

  const { sector_id, lat, lon, radio_m } = await req.json();
  if (!sector_id || typeof lat !== "number" || typeof lon !== "number" || !radio_m) {
    return NextResponse.json({ error: "Faltan sector_id, lat, lon o radio_m" }, { status: 400 });
  }
  if (radio_m > 2000) {
    return NextResponse.json(
      { error: "Radio máximo 2000 m: más allá la malla es inmanejable para una brigada" },
      { status: 400 }
    );
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

  // h3 es único global: si la celda ya existe (por un cerco previo) se respeta.
  const { error } = await supabase
    .from("minizonas")
    .upsert(filas, { onConflict: "h3", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, generadas: filas.length });
}
