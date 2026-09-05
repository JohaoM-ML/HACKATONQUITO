/**
 * Seed: lee data/cola.json del monorepo y escribe sectores + cola_items en Supabase.
 * Uso (desde web/):
 *   set SUPABASE_SERVICE_ROLE_KEY=...
 *   npx tsx scripts/seed-cola.ts
 *
 * Sin service role, preferir seed vía MCP execute_sql / panel SQL.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { clasificarBarrio, ordenarCola } from "../lib/motor/reglas";

const ROOT = path.resolve(__dirname, "../..");
const COLA_PATH = path.join(ROOT, "data", "cola.json");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const raw = JSON.parse(fs.readFileSync(COLA_PATH, "utf8"));
  const fechaEval = raw.generado_en || new Date().toISOString().slice(0, 10);
  const barrios = raw.barrios || [];

  console.log(`Seed ${barrios.length} barrios, fecha_eval=${fechaEval}`);

  for (const b of barrios) {
    const slug = b.id;
    const { data: sector, error: sErr } = await supabase
      .from("sectores")
      .upsert(
        {
          slug,
          nombre: b.nombre,
          zona: b.zona || null,
          lat: b.lat ?? null,
          lon: b.lon ?? null,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (sErr || !sector) {
      console.error("sector", slug, sErr?.message);
      continue;
    }

    const { data: corte } = await supabase
      .from("cortes")
      .insert({
        sector_id: sector.id,
        fecha_inicio: b.fecha_corte,
        duracion_horas: b.duracion_horas,
        duracion_horas_num: b.duracion_horas_num,
        pidio_almacenar: b.pidio_almacenar,
        motivo: b.motivo_corte,
        fuente: b.fuente,
        url: b.fuente_url,
        confianza: b.confianza,
      })
      .select("id")
      .single();

    const cls = clasificarBarrio(
      {
        fecha_corte: b.fecha_corte,
        duracion_horas: b.duracion_horas,
        duracion_horas_num: b.duracion_horas_num,
        pidio_almacenar: b.pidio_almacenar,
        confianza: b.confianza,
        nombre: b.nombre,
      },
      fechaEval
    );

    if (!cls.regla) continue;

    await supabase.from("cola_items").insert({
      sector_id: sector.id,
      corte_id: corte?.id ?? null,
      fecha_eval: fechaEval,
      regla: cls.regla,
      puntaje: cls.puntaje,
      prioridad: b.prioridad ?? null,
      accion: cls.accion,
      justificacion: cls.justificacion,
      hipotesis: !!cls.hipotesis,
      requiere_confirmacion_humana: !!cls.requiere_confirmacion_humana,
      label_regla: cls.label_regla || null,
      aplica_d: !!cls.aplica_d,
      evidencias: cls.evidencias,
      incertidumbre: cls.incertidumbre,
      origen_dato: cls.origen_dato,
      confianza: cls.confianza,
    });
  }

  // Reordenar prioridades A+B
  const { data: all } = await supabase
    .from("cola_items")
    .select("id, regla, puntaje, sectores(nombre)")
    .eq("fecha_eval", fechaEval);

  const ordered = ordenarCola(
    (all || []).map((x) => ({
      ...x,
      nombre: (x as { sectores?: { nombre?: string } }).sectores?.nombre || "",
      justificacion: "",
      accion: null,
      evidencias: [],
      incertidumbre: [],
      confianza: "B",
      origen_dato: [],
      aplica_d: false,
    }))
  );

  for (const o of ordered) {
    await supabase.from("cola_items").update({ prioridad: o.prioridad }).eq("id", o.id);
  }

  console.log("OK seed cola");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
