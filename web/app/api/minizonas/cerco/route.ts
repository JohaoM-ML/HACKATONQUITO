import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cercoDe, centroide, META_VIVIENDAS_MINIZONA } from "@/lib/geo/minizonas";

/**
 * Cerco perifocal. Cuando una vivienda sale positiva a larvas o pupas, las 6 minizonas
 * vecinas (~225 m alrededor del foco) quedan abiertas como pendientes de inspección.
 * Ese radio corresponde al bloqueo que aplican los protocolos de control ante un caso,
 * y el % de cercos cerrados es el KPI que sí podemos medir con los datos que tenemos.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { visita_id } = await req.json();
  if (!visita_id) return NextResponse.json({ error: "Falta visita_id" }, { status: 400 });

  const { data: visita } = await supabase
    .from("visitas")
    .select("id, sector_id, h3")
    .eq("id", visita_id)
    .maybeSingle();

  if (!visita?.h3) {
    // Sin GPS no hay celda, así que no hay cerco que abrir. No es un error de la app.
    return NextResponse.json({ ok: true, abiertas: 0, motivo: "visita sin GPS" });
  }

  const filas = cercoDe(visita.h3).map((h3) => {
    const c = centroide(h3);
    return {
      sector_id: visita.sector_id,
      h3,
      lat: c.lat,
      lon: c.lon,
      origen: "cerco" as const,
      foco_visita_id: visita.id,
      meta_viviendas: META_VIVIENDAS_MINIZONA,
    };
  });

  const { error } = await supabase
    .from("minizonas")
    .upsert(filas, { onConflict: "h3", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, abiertas: filas.length });
}
