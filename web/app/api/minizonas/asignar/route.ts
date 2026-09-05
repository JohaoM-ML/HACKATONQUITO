import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { META_MINIZONAS_DIA, ordenarPorCercania } from "@/lib/geo/minizonas";
import type { Minizona } from "@/types";

/**
 * Reparte las minizonas pendientes de un sector entre los brigadistas de la brigada.
 *
 * El reparto es geográfico, no alfabético: primero se ordena todo el conjunto por
 * cercanía y luego se corta en tramos contiguos, de modo que cada brigadista recibe
 * un bloque compacto en vez de celdas sueltas por todo el sector. Dentro de su bloque
 * el orden ya viene resuelto por vecino más cercano. Los bloques no se solapan.
 *
 * Ese bloque es multi-día: el recorte diario (META_MINIZONAS_DIA = 8 celdas,
 * ~40 viviendas) lo hace el cliente en MisMinizonas. Así el jefe no reasigna cada
 * mañana y cada persona sigue cubriendo su tramo del perímetro.
 *
 * Las minizonas de cerco van primero: son las que rodean un foco confirmado.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, brigada_id")
    .eq("id", user.id)
    .maybeSingle();
  if (perfil?.rol !== "jefe") {
    return NextResponse.json({ error: "Solo el jefe asigna minizonas" }, { status: 403 });
  }

  const { sector_id } = await req.json();
  if (!sector_id) return NextResponse.json({ error: "Falta sector_id" }, { status: 400 });

  const [{ data: minizonas }, { data: brigadistas }] = await Promise.all([
    supabase
      .from("minizonas")
      .select("id, sector_id, h3, lat, lon, estado, origen, foco_visita_id, meta_viviendas")
      .eq("sector_id", sector_id)
      .neq("estado", "cubierta"),
    supabase
      .from("perfiles")
      .select("id, nombre")
      .eq("brigada_id", perfil.brigada_id)
      .eq("rol", "brigadista"),
  ]);

  if (!brigadistas?.length) {
    return NextResponse.json({ error: "La brigada no tiene brigadistas" }, { status: 400 });
  }
  if (!minizonas?.length) {
    return NextResponse.json({ ok: true, asignadas: 0, motivo: "no hay minizonas pendientes" });
  }

  const lista = minizonas as Minizona[];
  const cercos = ordenarPorCercania(lista.filter((m) => m.origen === "cerco"));
  const malla = ordenarPorCercania(
    lista.filter((m) => m.origen !== "cerco"),
    cercos.at(-1)
  );
  const ordenadas = [...cercos, ...malla];

  const n = brigadistas.length;
  const porPersona = Math.ceil(ordenadas.length / n);

  const filas = brigadistas.flatMap((b, i) =>
    ordenadas
      .slice(i * porPersona, (i + 1) * porPersona)
      .map((m, orden) => ({ minizona_id: m.id, brigadista_id: b.id, orden, estado: "pendiente" }))
  );

  await supabase
    .from("asignaciones_minizona")
    .delete()
    .in("minizona_id", lista.map((m) => m.id))
    .eq("estado", "pendiente");

  const { error } = await supabase
    .from("asignaciones_minizona")
    .upsert(filas, { onConflict: "minizona_id,brigadista_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    asignadas: filas.length,
    brigadistas: n,
    cercos: cercos.length,
    cupo_diario: META_MINIZONAS_DIA,
  });
}
