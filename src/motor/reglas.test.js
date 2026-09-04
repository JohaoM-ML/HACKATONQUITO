/**
 * Tests sin framework del motor A–D.
 * Ejecutar: node src/motor/reglas.test.js
 */

"use strict";

const assert = require("assert");
const {
  clasificarBarrio,
  tendenciaCantonal,
  contextoLluvia,
  ordenarCola,
  parseFecha,
} = require("./reglas");

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed++;
    console.log("OK  " + name);
  } catch (e) {
    console.error("FAIL " + name);
    console.error("  " + e.message);
    process.exitCode = 1;
  }
}

ok("8-feb / eval 15-feb → regla A (Guasmo)", () => {
  const r = clasificarBarrio(
    {
      nombre: "Guasmo",
      fecha_corte: "2026-02-08",
      duracion_horas: "11-16",
      duracion_horas_num: 13.5,
      pidio_almacenar: "si",
      confianza: "B",
    },
    "2026-02-15",
    { tendencia: { tendencia: "baja" } }
  );
  assert.strictEqual(r.regla, "A");
  assert.ok(r.accion.includes("barriles") || r.accion.includes("tinas"));
  assert.ok(r.incertidumbre.includes("duracion_es_rango_punto_medio"));
  assert.ok(r.incertidumbre.includes("lista_sectores_ejemplo_incompleta"));
  assert.strictEqual(r.hipotesis, false);
});

ok("D no sube con serie 112,114,113,99", () => {
  const t = tendenciaCantonal([
    { semana_id: "2026-W03", casos: 112 },
    { semana_id: "2026-W04", casos: 114 },
    { semana_id: "2026-W05", casos: 113 },
    { semana_id: "2026-W06", casos: 99 },
  ]);
  assert.notStrictEqual(t.tendencia, "sube");
});

ok("D sube con serie claramente alcista", () => {
  const t = tendenciaCantonal([
    { semana_id: "w1", casos: 100 },
    { semana_id: "w2", casos: 120 },
    { semana_id: "w3", casos: 140 },
    { semana_id: "w4", casos: 160 },
  ]);
  assert.strictEqual(t.tendencia, "sube");
});

ok("C no inventa barrios — solo contexto", () => {
  const c = contextoLluvia({
    fecha_eval: parseFecha("2026-02-15"),
    semanas: [
      { precipitacion_mm: 86 },
      { precipitacion_mm: 72 },
      { precipitacion_mm: 91 },
      { precipitacion_mm: 86 },
    ],
  });
  assert.ok(c.nota.includes("no se emiten ítems") || c.nota.includes("Sin catálogo"));
  assert.ok(c.precip_mm_acum > 50);
});

ok("Regla B en ventana 7–14 días marcada como hipótesis", () => {
  // 15-feb-2026 menos 11 días = 04-feb-2026 (ciclo huevo→adulto de Aedes aegypti)
  const r = clasificarBarrio(
    {
      nombre: "Guayacanes",
      fecha_corte: "2026-02-04",
      duracion_horas: "",
      duracion_horas_num: null,
      pidio_almacenar: "NA",
      confianza: "B",
    },
    "2026-02-15",
    { tendencia: { tendencia: "estable" } }
  );
  assert.strictEqual(r.regla, "B");
  assert.strictEqual(r.hipotesis, true);
  assert.strictEqual(r.requiere_confirmacion_humana, true);
  assert.ok(r.justificacion.toLowerCase().includes("hipótesis") || r.justificacion.toLowerCase().includes("hipotesis"));
  assert.ok(r.incertidumbre.includes("regla_b_hipotesis_no_validada_ecuador"));
  assert.ok(r.incertidumbre.includes("regla_b_sin_metricas_no_existe_dengue_por_barrio"));
});

ok("Corte de 12–20 semanas ya NO genera regla B", () => {
  // Ventana vieja (rezago Lowe): sin efecto significativo en results/lag_effects.csv
  const r = clasificarBarrio(
    {
      nombre: "Guayacanes",
      fecha_corte: "2025-10-20",
      duracion_horas_num: null,
      pidio_almacenar: "NA",
    },
    "2026-02-15"
  );
  assert.strictEqual(r.regla, null);
});

ok("B nunca supera a A en puntaje (techo B < piso A)", () => {
  const base = { nombre: "Z", pidio_almacenar: "si", duracion_horas_num: 8 };
  const a = clasificarBarrio({ ...base, fecha_corte: "2026-02-08" }, "2026-02-15",
    { tendencia: { tendencia: "estable" } });
  const b = clasificarBarrio(
    { nombre: "Z", fecha_corte: "2026-02-08", duracion_horas_num: null, pidio_almacenar: "NA" },
    "2026-02-15",
    { tendencia: { tendencia: "sube" } }
  );
  assert.strictEqual(a.regla, "A");
  assert.strictEqual(b.regla, "B");
  assert.ok(b.puntaje < a.puntaje, `B=${b.puntaje} debe ser < A=${a.puntaje}`);
});

ok("Sin almacenar en 0–14 d no aplica A", () => {
  const r = clasificarBarrio(
    {
      nombre: "X",
      fecha_corte: "2026-02-10",
      duracion_horas: "12",
      duracion_horas_num: 12,
      pidio_almacenar: "no",
    },
    "2026-02-15"
  );
  assert.strictEqual(r.regla, null);
});

ok("ordenarCola: A antes que B", () => {
  const orden = ordenarCola([
    { nombre: "B1", regla: "B", puntaje: 50 },
    { nombre: "A1", regla: "A", puntaje: 90 },
  ]);
  assert.strictEqual(orden[0].regla, "A");
  assert.strictEqual(orden[0].prioridad, 1);
  assert.strictEqual(orden[1].prioridad, 2);
});

ok("No fabrica lat/lon", () => {
  const r = clasificarBarrio(
    {
      nombre: "Guasmo",
      fecha_corte: "2026-02-08",
      duracion_horas_num: 13.5,
      pidio_almacenar: "si",
    },
    "2026-02-15"
  );
  assert.ok(!("lat" in r) || r.lat == null);
});

console.log(`\n${passed} tests passed`);
