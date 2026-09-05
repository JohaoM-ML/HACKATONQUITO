/**
 * Tests de avisos A/B para vecinos (sin framework).
 * npx tsx lib/public/cortes.test.ts
 */
import { buildAvisoVecino, coincideSector, lookupZonaVecino } from "./cortes";

function ok(name: string, fn: () => void) {
  try {
    fn();
    console.log("OK", name);
  } catch (e) {
    console.error("FAIL", name, e);
    process.exitCode = 1;
  }
}

ok("aviso A no promete fumigación ni dengue", () => {
  const t = buildAvisoVecino("A", "Guasmo");
  if (!t.includes("Sector Guasmo")) throw new Error(t);
  if (!/brigada|recipientes/i.test(t)) throw new Error(t);
  if (!t.includes("no confirma fumigación")) throw new Error(t);
});

ok("aviso B es hipótesis y no agenda ruta", () => {
  const t = buildAvisoVecino("B", "Mapasingue");
  if (!t.includes("Sector Mapasingue")) throw new Error(t);
  if (!t.includes("hipótesis")) throw new Error(t);
  if (!t.includes("no programa visita")) throw new Error(t);
  if (/vamos a fumigar|se reduce el dengue/i.test(t)) throw new Error(t);
});

ok("lookup A gana sobre coincidencia parcial", () => {
  const data = {
    cola_regla_a: [
      {
        regla: "A" as const,
        sector: "Guasmo",
        accion: null,
        justificacion: null,
        prioridad: 1,
        fecha_eval: "2026-09-05",
        hipotesis: false,
        aviso_vecino: buildAvisoVecino("A", "Guasmo"),
      },
    ],
    cola_regla_b: [
      {
        regla: "B" as const,
        sector: "Mapasingue",
        accion: null,
        justificacion: null,
        prioridad: 8,
        fecha_eval: "2026-09-05",
        hipotesis: true,
        aviso_vecino: buildAvisoVecino("B", "Mapasingue"),
      },
    ],
  };
  const a = lookupZonaVecino(data, "guasmo");
  if (a.regla !== "A") throw new Error(String(a.regla));
  const b = lookupZonaVecino(data, "mapasingue");
  if (b.regla !== "B") throw new Error(String(b.regla));
  const none = lookupZonaVecino(data, "Sauces");
  if (none.regla !== null) throw new Error(String(none.regla));
});

ok("Vergeles coincide con nombre largo", () => {
  if (!coincideSector("vergeles", "Los Vergeles y alrededores")) {
    throw new Error("no match");
  }
});
