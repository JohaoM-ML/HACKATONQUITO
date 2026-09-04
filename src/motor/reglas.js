/**
 * Motor de reglas A–D (proxy operativo, no modelo calibrado).
 * Reglas exactas de division-tareas.txt — no se inventan otras.
 *
 * A  corte ≥ 8 h  hace 0–14 días  + pidió almacenar → COLA ESTA SEMANA
 * B  corte hace 12–20 semanas → ALERTA TARDÍA (hipótesis Lowe, no hecho EC)
 * C  lluvia/temporada 0–8 sem, sin corte → MINGA LLANTAS (sin catálogo = sin ítems)
 * D  cantón con casos subiendo → +prioridad, NO define barrio
 */

"use strict";

const MS_DIA = 24 * 60 * 60 * 1000;
const MS_SEM = 7 * MS_DIA;

function parseFecha(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function diasEntre(a, b) {
  return Math.round((b.getTime() - a.getTime()) / MS_DIA);
}

function semanasEntre(a, b) {
  return diasEntre(a, b) / 7;
}

/**
 * Duración usable para umbral ≥8 h.
 * Si es rango, usa punto medio (derivado). Si falta, unknown.
 */
function horasParaUmbral(barrio) {
  if (barrio.duracion_horas_num != null && barrio.duracion_horas_num !== "") {
    return { horas: Number(barrio.duracion_horas_num), origen: "derivado" };
  }
  const raw = barrio.duracion_horas;
  if (raw == null || raw === "" || raw === "NA") {
    return { horas: null, origen: "unknown" };
  }
  const s = String(raw);
  if (s.includes("-")) {
    const [lo, hi] = s.split("-").map(Number);
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
      return { horas: (lo + hi) / 2, origen: "derivado", rango: s };
    }
  }
  const n = Number(s);
  if (!Number.isNaN(n)) return { horas: n, origen: "observado" };
  return { horas: null, origen: "unknown" };
}

function pidioAlmacenar(barrio) {
  const v = barrio.pidio_almacenar ?? barrio.almacenar;
  if (v === true || v === 1 || v === "1" || String(v).toLowerCase() === "si" || String(v).toLowerCase() === "sí") {
    return true;
  }
  if (v === false || v === 0 || v === "0" || String(v).toLowerCase() === "no") {
    return false;
  }
  return null; // unknown
}

/**
 * Tendencia D: últimas 4 semanas de casos antes o en la semana de evaluación.
 * sube = cada semana ≥ anterior y al menos un incremento; o último > primero con ≥2 alzas.
 * Sin inventar: si faltan datos → unknown.
 */
function tendenciaCantonal(casosSemanas) {
  if (!Array.isArray(casosSemanas) || casosSemanas.length < 4) {
    return {
      tendencia: "unknown",
      semanas: casosSemanas || [],
      nota: "Se requieren ≥4 semanas de casos cantonales/provinciales. Pendiente de validación.",
    };
  }
  const ult = casosSemanas.slice(-4);
  const vals = ult.map((x) => x.casos);
  if (vals.some((v) => v == null || Number.isNaN(Number(v)))) {
    return {
      tendencia: "unknown",
      semanas: ult,
      nota: "Serie incompleta (NA). No se aplica bonus D.",
    };
  }
  const nums = vals.map(Number);
  let alzas = 0;
  let bajas = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > nums[i - 1]) alzas++;
    else if (nums[i] < nums[i - 1]) bajas++;
  }
  let tendencia = "estable";
  if (alzas >= 2 && nums[3] > nums[0]) tendencia = "sube";
  else if (bajas >= 2 && nums[3] < nums[0]) tendencia = "baja";
  return {
    tendencia,
    semanas: ult,
    nota:
      tendencia === "sube"
        ? "Casos provinciales en tendencia alcista (4 semanas). Bonus de prioridad, no define barrio."
        : `Tendencia ${tendencia} en 4 semanas. Sin bonus D.`,
  };
}

/**
 * Contexto lluvia para regla C (cantonal). No crea barrios.
 */
function contextoLluvia(climaVentana) {
  if (!climaVentana || !Array.isArray(climaVentana.semanas) || climaVentana.semanas.length === 0) {
    return {
      temporada_invernal: "unknown",
      precip_mm_acum: null,
      nota: "Sin serie de precipitación. Regla C no genera ítems.",
    };
  }
  const acum = climaVentana.semanas.reduce((s, w) => s + (Number(w.precipitacion_mm) || 0), 0);
  // Guayaquil: dic–mayo ≈ invierno; se marca si hay lluvia acumulada material
  const mes = climaVentana.fecha_eval ? climaVentana.fecha_eval.getMonth() + 1 : null;
  const invernalCal = mes != null && (mes <= 5 || mes === 12);
  const lluviaMaterial = acum >= 50; // umbral operativo transparente, no calibrado
  return {
    temporada_invernal: invernalCal,
    precip_mm_acum: Math.round(acum * 10) / 10,
    lluvia_material: lluviaMaterial,
    nota:
      "Regla C es cantonal (lluvia sin corte). Sin catálogo de barrios sin corte no se emiten ítems. " +
      `Precip. acum. 0–8 sem: ${Math.round(acum)} mm. Temporada invernal: ${invernalCal ? "sí" : "no"}.`,
  };
}

/**
 * Clasifica un barrio/sector observado.
 * Precedencia: A > B > (sin regla de cola). C y D no definen barrio.
 */
function clasificarBarrio(barrio, fechaEval, contexto = {}) {
  const evalDate = typeof fechaEval === "string" ? parseFecha(fechaEval) : fechaEval;
  const fechaCorte = parseFecha(barrio.fecha_corte || barrio.fecha_inicio);
  const evidencias = [];
  const incertidumbre = [];
  const origen_dato = [];

  if (!evalDate) {
    return {
      regla: null,
      accion: null,
      justificacion: "Fecha de evaluación inválida.",
      puntaje: 0,
      evidencias: [],
      incertidumbre: ["fecha_evaluacion_invalida"],
      confianza: barrio.confianza || "unknown",
      origen_dato: ["unknown"],
      aplica_d: false,
    };
  }

  if (!fechaCorte) {
    incertidumbre.push("fecha_corte_desconocida");
    return {
      regla: null,
      accion: "Pendiente de validación",
      justificacion: "Sin fecha de corte observable. No se clasifica.",
      puntaje: 0,
      evidencias: [],
      incertidumbre,
      confianza: barrio.confianza || "unknown",
      origen_dato: ["unknown"],
      aplica_d: false,
    };
  }

  origen_dato.push("observado"); // fecha_corte, sectores del CSV
  const dias = diasEntre(fechaCorte, evalDate);
  const sem = semanasEntre(fechaCorte, evalDate);
  evidencias.push({ campo: "dias_desde_corte", valor: dias, origen: "derivado" });
  evidencias.push({ campo: "semanas_desde_corte", valor: Math.round(sem * 10) / 10, origen: "derivado" });

  const { horas, origen: origenHoras, rango } = horasParaUmbral(barrio);
  if (horas == null) {
    incertidumbre.push("duracion_horas_desconocida");
  } else {
    evidencias.push({
      campo: "duracion_horas_umbral",
      valor: horas,
      origen: origenHoras,
      rango_observado: rango || barrio.duracion_horas || null,
    });
    if (origenHoras === "derivado") {
      origen_dato.push("derivado");
      incertidumbre.push("duracion_es_rango_punto_medio");
    }
  }

  const almacenar = pidioAlmacenar(barrio);
  if (almacenar === null) {
    incertidumbre.push("pidio_almacenar_desconocido");
  } else {
    evidencias.push({ campo: "pidio_almacenar", valor: almacenar, origen: "observado" });
  }

  incertidumbre.push("lista_sectores_ejemplo_incompleta");

  const tendencia = contexto.tendencia || { tendencia: "unknown" };
  const aplicaD = tendencia.tendencia === "sube";

  // --- Regla A ---
  const cumpleA =
    horas != null &&
    horas >= 8 &&
    dias >= 0 &&
    dias <= 14 &&
    almacenar === true;

  if (cumpleA) {
    let puntaje = 80 + Math.min(15, Math.round(horas)); // ranking operativo, NO probabilidad
    if (aplicaD) puntaje += 5;
    const durTxt =
      rango || barrio.duracion_horas
        ? `${rango || barrio.duracion_horas} h (umbral con ${horas} h)`
        : `${horas} h`;
    return {
      regla: "A",
      accion: "Inspeccionar barriles y tinas. Pedir que tapen.",
      justificacion:
        `Corte de ${durTxt} hace ${dias} días. ` +
        `Interagua/prensa reportó pedido de almacenar. ` +
        `Regla A: cola de esta semana.` +
        (aplicaD ? " Bonus D: casos provinciales en alza (no define el barrio)." : ""),
      puntaje,
      evidencias,
      incertidumbre,
      confianza: barrio.confianza || "B",
      origen_dato: [...new Set(origen_dato)],
      aplica_d: aplicaD,
      hipotesis: false,
      label_regla: "COLA ESTA SEMANA",
    };
  }

  // --- Regla B ---
  const cumpleB = sem >= 12 && sem <= 20;
  if (cumpleB) {
    let puntaje = 40 + Math.round((20 - sem) * 2);
    if (aplicaD) puntaje += 5;
    return {
      regla: "B",
      accion: "Alerta de brote tardío: revisar recipientes (hipótesis, no hecho EC).",
      justificacion:
        `Corte hace ~${Math.round(sem)} semanas (ventana 12–20). ` +
        `Regla B = hipótesis de rezago Lowe; NO validada con datos ecuatorianos en este proyecto. ` +
        `Requiere confirmación humana antes de priorizar como hallazgo.`,
      puntaje,
      evidencias,
      incertidumbre: [...incertidumbre, "regla_b_hipotesis_no_validada_ecuador"],
      confianza: barrio.confianza || "B",
      origen_dato: [...new Set([...origen_dato, "inferido"])],
      aplica_d: aplicaD,
      hipotesis: true,
      label_regla: "ALERTA TARDÍA (hipótesis)",
      requiere_confirmacion_humana: true,
    };
  }

  // Sin A ni B: no entra a cola de caminata
  return {
    regla: null,
    accion: null,
    justificacion:
      dias < 0
        ? "Fecha de corte posterior a la evaluación."
        : horas == null
          ? "Duración desconocida: no se puede aplicar umbral ≥8 h. Pendiente de validación."
          : dias > 14 && (sem < 12 || sem > 20)
            ? `Fuera de ventanas A (0–14 d) y B (12–20 sem). Días desde corte: ${dias}.`
            : almacenar !== true && dias <= 14
              ? "Dentro de 0–14 días pero sin pedido explícito de almacenar (o unknown). No aplica A."
              : "Sin regla A/B aplicable.",
    puntaje: 0,
    evidencias,
    incertidumbre,
    confianza: barrio.confianza || "unknown",
    origen_dato: [...new Set(origen_dato)],
    aplica_d: aplicaD,
    hipotesis: false,
  };
}

/**
 * Ranking operativo transparente (no calibrado, no es P(brote)).
 * Orden: A > B > C; dentro, más horas; luego nombre.
 */
function ordenarCola(items) {
  const peso = { A: 3, B: 2, C: 1 };
  return [...items].sort((a, b) => {
    const pa = peso[a.regla] || 0;
    const pb = peso[b.regla] || 0;
    if (pb !== pa) return pb - pa;
    if ((b.puntaje || 0) !== (a.puntaje || 0)) return (b.puntaje || 0) - (a.puntaje || 0);
    return String(a.nombre).localeCompare(String(b.nombre), "es");
  }).map((item, i) => ({ ...item, prioridad: i + 1 }));
}

module.exports = {
  parseFecha,
  diasEntre,
  semanasEntre,
  horasParaUmbral,
  pidioAlmacenar,
  tendenciaCantonal,
  contextoLluvia,
  clasificarBarrio,
  ordenarCola,
};
