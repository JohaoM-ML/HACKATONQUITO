/**
 * Genera data/cola.json a partir de cortes reales + contexto dengue/clima.
 *
 *   node src/motor/generar-cola.js --fecha 2026-02-15
 *
 * Solo usa sectores nombrados en el CSV. No fabrica barrios ni predios.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const {
  clasificarBarrio,
  tendenciaCantonal,
  contextoLluvia,
  ordenarCola,
  parseFecha,
} = require("./reglas");
const {
  extraerBarriosDesdeCsv,
  barriosToCsv,
  readCsv,
} = require("./extraer-cortes");

const ROOT = path.resolve(__dirname, "../..");

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

function isoWeekId(date) {
  // ISO week: Thursday-based
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function loadTendenciaDengue(fechaEval) {
  const p = path.join(ROOT, "data/raw/dengue_guayas_semanal_gaceta.csv");
  if (!fs.existsSync(p)) {
    return tendenciaCantonal([]);
  }
  const rows = readCsv(p);
  const evalWeek = isoWeekId(fechaEval);
  const sorted = rows
    .map((r) => ({
      semana_id: r.semana_id,
      casos: Number(r.casos_dengue),
      geografia: r.geografia,
      confianza: r.confianza,
    }))
    .filter((r) => r.semana_id && !Number.isNaN(r.casos))
    .sort((a, b) => a.semana_id.localeCompare(b.semana_id));

  // Semanas hasta la de evaluación (inclusive si existe)
  const hasta = sorted.filter((r) => r.semana_id <= evalWeek);
  const ventana = hasta.slice(-4);
  const t = tendenciaCantonal(ventana);
  t.geografia = "Guayas (provincial, no cantonal/barrio)";
  t.fuente = "MSP Gaceta ETV — extracción etiquetas 2026";
  t.confianza = "B";
  return t;
}

function loadClima(fechaEval) {
  const p = path.join(ROOT, "data/clean/clima_guayaquil_semanal.csv");
  if (!fs.existsSync(p)) {
    return contextoLluvia(null);
  }
  const rows = readCsv(p);
  const evalWeek = isoWeekId(fechaEval);
  const sorted = rows
    .filter((r) => r.semana_id)
    .sort((a, b) => a.semana_id.localeCompare(b.semana_id));
  const hasta = sorted.filter((r) => r.semana_id <= evalWeek);
  const ventana = hasta.slice(-8).map((r) => ({
    semana_id: r.semana_id,
    precipitacion_mm: Number(r.precipitacion_mm),
  }));
  return contextoLluvia({ fecha_eval: fechaEval, semanas: ventana });
}

function uniqueByIdKeepLatest(barrios) {
  // Para la cola del día: un ítem por barrio; si hay varios cortes, el más reciente
  const map = new Map();
  for (const b of barrios) {
    const prev = map.get(b.id);
    if (!prev || String(b.fecha_corte) >= String(prev.fecha_corte)) {
      map.set(b.id, b);
    }
  }
  return [...map.values()];
}

function main() {
  const fechaStr = arg("--fecha", "2026-02-15");
  const fechaEval = parseFecha(fechaStr);
  if (!fechaEval) {
    console.error("Fecha inválida:", fechaStr);
    process.exit(1);
  }

  const cortesPath = path.join(ROOT, "data/clean/cortes_interagua_clean.csv");
  const allBarrios = extraerBarriosDesdeCsv(cortesPath);

  // Persistir expansión completa (trazabilidad)
  const barriosCsvPath = path.join(ROOT, "data/barrios_cortes.csv");
  fs.writeFileSync(barriosCsvPath, barriosToCsv(allBarrios), "utf8");

  const tendencia = loadTendenciaDengue(fechaEval);
  const lluvia = loadClima(fechaEval);
  const contexto = { tendencia, lluvia };

  // Solo cortes con fecha ≤ evaluación (no usar eventos futuros del CSV).
  // Únicos por id: el corte más reciente que ya ocurrió.
  const observadosHastaEval = allBarrios.filter(
    (b) => b.fecha_corte && b.fecha_corte <= fechaStr
  );
  const candidatos = uniqueByIdKeepLatest(observadosHastaEval);

  const clasificados = [];
  for (const b of candidatos) {
    const r = clasificarBarrio(b, fechaEval, contexto);
    if (!r.regla) continue;
    clasificados.push({
      id: b.id,
      nombre: b.nombre,
      zona: b.zona,
      lat: null,
      lon: null,
      fecha_corte: b.fecha_corte,
      duracion_horas: b.duracion_horas || null,
      duracion_horas_num: b.duracion_horas_num,
      pidio_almacenar: b.pidio_almacenar === "si" || b.almacenar === "1" || b.almacenar === 1,
      regla: r.regla,
      puntaje: r.puntaje,
      accion: r.accion,
      justificacion: r.justificacion,
      fuente: b.fuente || null,
      fuente_url: b.fuente_url || null,
      confianza: r.confianza,
      origen_dato: r.origen_dato,
      incertidumbre: r.incertidumbre,
      evidencias: r.evidencias,
      hipotesis: !!r.hipotesis,
      requiere_confirmacion_humana: !!r.requiere_confirmacion_humana,
      label_regla: r.label_regla || r.regla,
      aplica_d: r.aplica_d,
      motivo_corte: b.motivo || null,
    });
  }

  const ordenados = ordenarCola(clasificados);
  const colaSemana = ordenados.filter((x) => x.regla === "A");
  const alertasB = ordenados.filter((x) => x.regla === "B");

  const cola = {
    generado_en: fechaStr,
    canton: "Guayaquil",
    empresa_agua: "Interagua",
    modelo: "reglas (proxy operativo del DLNM; ajuste INLA = mes 1)",
    nota_modelo:
      "El modelo estadístico conjunto (clima+cortes) empeoró MAE 288→394 en experimentos NAT. " +
      "No se afirma rezago 3–5 meses validado en Ecuador. Validar rezago = mes 1 del piloto.",
    nota_datos:
      "Sectores tomados exclusivamente de sectores_ejemplo del CSV. " +
      "Lista incompleta por diseño (ejemplos de prensa). lat/lon=null. " +
      "Predios no existen en datos: se registran en campo.",
    puntaje_nota: "Ranking operativo transparente, no calibrado, no es probabilidad de brote.",
    contexto_cantonal: {
      dengue: {
        tendencia: tendencia.tendencia,
        nota: tendencia.nota,
        semanas: tendencia.semanas || [],
        geografia: tendencia.geografia || null,
        fuente: tendencia.fuente || null,
        confianza: tendencia.confianza || "unknown",
        aplica_bonus_prioridad: tendencia.tendencia === "sube",
      },
      lluvia: {
        temporada_invernal: lluvia.temporada_invernal,
        precip_mm_acum_0_8_sem: lluvia.precip_mm_acum,
        lluvia_material: lluvia.lluvia_material,
        nota: lluvia.nota,
        regla_c_items: [],
        regla_c_razon: "Sin catálogo de barrios sin corte: C no emite ítems.",
      },
    },
    barrios: ordenados,
    cola_brigada: colaSemana.map((b) => b.id),
    alertas_hipotesis: alertasB.map((b) => b.id),
    meta: {
      n_sectores_csv_total: allBarrios.length,
      n_candidatos_unicos: candidatos.length,
      n_regla_a: colaSemana.length,
      n_regla_b: alertasB.length,
      n_regla_c: 0,
      fuente_cortes: "data/clean/cortes_interagua_clean.csv",
      barrios_cortes: "data/barrios_cortes.csv",
    },
  };

  const outData = path.join(ROOT, "data/cola.json");
  const outApp = path.join(ROOT, "src/app/data/cola.json");
  fs.mkdirSync(path.dirname(outApp), { recursive: true });
  const json = JSON.stringify(cola, null, 2);
  fs.writeFileSync(outData, json, "utf8");
  fs.writeFileSync(outApp, json, "utf8");

  console.log(`Fecha evaluación: ${fechaStr}`);
  console.log(`Barrios CSV expandidos: ${allBarrios.length} → ${barriosCsvPath}`);
  console.log(`Tendencia D: ${tendencia.tendencia}`);
  console.log(`Cola A (brigada): ${colaSemana.length}`);
  console.log(`Alertas B (hipótesis): ${alertasB.length}`);
  console.log(`Escrito: ${outData}`);
  console.log(`Escrito: ${outApp}`);
  if (colaSemana.length) {
    console.log("Prioridad brigada:");
    colaSemana.forEach((b) => console.log(`  ${b.prioridad}. ${b.nombre} [${b.regla}]`));
  }
}

main();
