import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const DICT = {
  visita_id: "UUID visita",
  sector_nombre: "Nombre del sector/barrio",
  zona: "Zona ciudad",
  estado_visita: "inspeccionada|cerrada|renuente|deshabitada",
  fecha_hora: "ISO timestamp",
  codigo_vivienda: "Código local",
  lat: "Latitud GPS",
  lon: "Longitud GPS",
  n_habitantes: "Habitantes en vivienda",
  tiene_conexion_red: "bool",
  dias_sin_agua_ultima_semana: "0-7",
  horas_agua_por_dia: "menos_4|4_8|8_16|todo_el_dia",
  almacena_agua: "bool",
  motivo_almacenamiento: "corte_programado|corte_emergente|presion_baja|costumbre|no_aplica",
  dias_almacenada: "días con agua almacenada",
  recibio_tanquero: "bool",
  recipiente_tipo: "tipo Stegomyia",
  uso: "almacenamiento_consumo|almacenamiento_limpieza|desecho|decorativo",
  capacidad_l: "menos_20|20_100|100_500|mas_500",
  tapado: "si|parcial|no",
  con_agua: "bool",
  ubicacion: "interior|patio|techo",
  positivo_larvas: "bool",
  positivo_pupas: "bool",
  n_pupas: "1_10|11_50|mas_50",
  tratado: "larvicida|eliminado|tapado|ninguno",
};

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "jefe") {
    return NextResponse.json({ error: "Solo jefes exportan" }, { status: 403 });
  }

  const { data: visitas, error } = await supabase
    .from("visitas")
    .select("*, sectores(nombre, zona), recipientes(*)")
    .order("fecha_hora", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = Object.keys(DICT);
  const lines = [
    "# DICCIONARIO: " + JSON.stringify(DICT),
    headers.join(","),
  ];

  for (const v of visitas || []) {
    const recips = (v.recipientes as Record<string, unknown>[]) || [];
    if (!recips.length) {
      const row: Record<string, unknown> = {
        visita_id: v.id,
        sector_nombre: v.sectores?.nombre,
        zona: v.sectores?.zona,
        estado_visita: v.estado_visita,
        fecha_hora: v.fecha_hora,
        codigo_vivienda: v.codigo_vivienda,
        lat: v.lat,
        lon: v.lon,
        n_habitantes: v.n_habitantes,
        tiene_conexion_red: v.tiene_conexion_red,
        dias_sin_agua_ultima_semana: v.dias_sin_agua_ultima_semana,
        horas_agua_por_dia: v.horas_agua_por_dia,
        almacena_agua: v.almacena_agua,
        motivo_almacenamiento: v.motivo_almacenamiento,
        dias_almacenada: v.dias_almacenada,
        recibio_tanquero: v.recibio_tanquero,
        recipiente_tipo: "",
        uso: "",
        capacidad_l: "",
        tapado: "",
        con_agua: "",
        ubicacion: "",
        positivo_larvas: "",
        positivo_pupas: "",
        n_pupas: "",
        tratado: "",
      };
      lines.push(headers.map((h) => csvEscape(row[h])).join(","));
    } else {
      for (const r of recips) {
        const row: Record<string, unknown> = {
          visita_id: v.id,
          sector_nombre: v.sectores?.nombre,
          zona: v.sectores?.zona,
          estado_visita: v.estado_visita,
          fecha_hora: v.fecha_hora,
          codigo_vivienda: v.codigo_vivienda,
          lat: v.lat,
          lon: v.lon,
          n_habitantes: v.n_habitantes,
          tiene_conexion_red: v.tiene_conexion_red,
          dias_sin_agua_ultima_semana: v.dias_sin_agua_ultima_semana,
          horas_agua_por_dia: v.horas_agua_por_dia,
          almacena_agua: v.almacena_agua,
          motivo_almacenamiento: v.motivo_almacenamiento,
          dias_almacenada: v.dias_almacenada,
          recibio_tanquero: v.recibio_tanquero,
          recipiente_tipo: r.tipo,
          uso: r.uso,
          capacidad_l: r.capacidad_l,
          tapado: r.tapado,
          con_agua: r.con_agua,
          ubicacion: r.ubicacion,
          positivo_larvas: r.positivo_larvas,
          positivo_pupas: r.positivo_pupas,
          n_pupas: r.n_pupas,
          tratado: r.tratado,
        };
        lines.push(headers.map((h) => csvEscape(row[h])).join(","));
      }
    }
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ventana-seca-dataset-recipientes.csv"',
    },
  });
}
