/**
 * Tests mínimos del motor (sin framework).
 * node --import tsx lib/motor/reglas.test.ts  OR  npx tsx lib/motor/reglas.test.ts
 */
import { clasificarBarrio, ordenarCola } from "./reglas";

function ok(name: string, fn: () => void) {
  try {
    fn();
    console.log("OK", name);
  } catch (e) {
    console.error("FAIL", name, e);
    process.exitCode = 1;
  }
}

ok("Regla A ≥8h + almacenar + 0-14d", () => {
  const r = clasificarBarrio(
    {
      fecha_corte: "2026-02-08",
      duracion_horas: "11-16",
      duracion_horas_num: 13.5,
      pidio_almacenar: true,
      nombre: "Test",
    },
    "2026-02-15"
  );
  if (r.regla !== "A") throw new Error(String(r.regla));
  if (r.puntaje < 80) throw new Error(String(r.puntaje));
});

ok("Regla B en ventana 7–14 días marcada como hipótesis", () => {
  const r = clasificarBarrio(
    {
      fecha_corte: "2026-02-05",
      duracion_horas: "4",
      pidio_almacenar: false,
      nombre: "TestB",
    },
    "2026-02-15"
  );
  if (r.regla !== "B") throw new Error(String(r.regla));
  if (!r.hipotesis) throw new Error("no hipotesis");
});

ok("Corte de 12–20 semanas ya NO genera regla B", () => {
  const r = clasificarBarrio(
    {
      fecha_corte: "2025-10-01",
      duracion_horas: "10",
      pidio_almacenar: true,
      nombre: "Old",
    },
    "2026-02-15"
  );
  if (r.regla === "B") throw new Error("B no debe aplicar");
});

ok("B nunca supera a A en puntaje", () => {
  const a = clasificarBarrio(
    { fecha_corte: "2026-02-08", duracion_horas: "8", pidio_almacenar: true },
    "2026-02-15"
  );
  const b = clasificarBarrio(
    { fecha_corte: "2026-02-05", duracion_horas: "4", pidio_almacenar: false },
    "2026-02-15"
  );
  if ((b.puntaje || 0) >= (a.puntaje || 0)) throw new Error("B >= A");
});

ok("ordenarCola A antes que B", () => {
  const o = ordenarCola([
    { ...clasificarBarrio({ fecha_corte: "2026-02-05", duracion_horas: "3", pidio_almacenar: false, nombre: "B1" }, "2026-02-15"), nombre: "B1" },
    { ...clasificarBarrio({ fecha_corte: "2026-02-08", duracion_horas: "12", pidio_almacenar: true, nombre: "A1" }, "2026-02-15"), nombre: "A1" },
  ]);
  if (o[0].regla !== "A") throw new Error("orden");
});

console.log("tests done");
