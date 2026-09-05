/**
 * Motor de reglas A–D (proxy operativo, no modelo calibrado).
 * Port fiel de src/motor/reglas.js — no se inventan otras reglas.
 *
 * A  corte ≥ 8 h  hace 0–14 días  + pidió almacenar → COLA ESTA SEMANA
 * B  corte hace 7–14 días, sin confirmar almacenamiento/duración → VENTANA DE CRIADERO (hipótesis)
 * C  lluvia/temporada 0–8 sem, sin corte → MINGA LLANTAS (sin catálogo = sin ítems)
 * D  cantón con casos subiendo → +prioridad, NO define barrio
 *
 * CAMBIO DE VENTANA EN REGLA B (antes 12–20 semanas, rezago de Lowe et al. 2017):
 * la ventana original se descartó por dos motivos (ver reglas.js original).
 * B sigue siendo HIPÓTESIS sin validar.
 */

const MS_DIA = 24 * 60 * 60 * 1000;

export type BarrioInput = {
  fecha_corte?: string | null;
  fecha_inicio?: string | null;
  duracion_horas?: string | number | null;
  duracion_horas_num?: number | string | null;
  pidio_almacenar?: boolean | string | number | null;
  almacenar?: boolean | string | number | null;
  confianza?: string | null;
  nombre?: string;
};

export type Evidencia = {
  campo: string;
  valor: unknown;
  origen: string;
  rango_observado?: string | null;
};

export type Clasificacion = {
  regla: "A" | "B" | "C" | null;
  accion: string | null;
  justificacion: string;
  puntaje: number;
  evidencias: Evidencia[];
  incertidumbre: string[];
  confianza: string;
  origen_dato: string[];
  aplica_d: boolean;
  hipotesis?: boolean;
  label_regla?: string;
  requiere_confirmacion_humana?: boolean;
  prioridad?: number;
  nombre?: string;
};

export function parseFecha(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_DIA);
}

export function semanasEntre(a: Date, b: Date): number {
  return diasEntre(a, b) / 7;
}

export function horasParaUmbral(barrio: BarrioInput): {
  horas: number | null;
  origen: string;
  rango?: string;
} {
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

export function pidioAlmacenar(barrio: BarrioInput): boolean | null {
  const v = barrio.pidio_almacenar ?? barrio.almacenar;
  if (v === true || v === 1 || v === "1" || String(v).toLowerCase() === "si" || String(v).toLowerCase() === "sí") {
    return true;
  }
  if (v === false || v === 0 || v === "0" || String(v).toLowerCase() === "no") {
    return false;
  }
  return null;
}

export function tendenciaCantonal(
  casosSemanas: { casos: number | null }[] | null | undefined
) {
  if (!Array.isArray(casosSemanas) || casosSemanas.length < 4) {
    return {
      tendencia: "unknown" as const,
      semanas: casosSemanas || [],
      nota: "Se requieren ≥4 semanas de casos cantonales/provinciales. Pendiente de validación.",
    };
  }
  const ult = casosSemanas.slice(-4);
  const vals = ult.map((x) => x.casos);
  if (vals.some((v) => v == null || Number.isNaN(Number(v)))) {
    return {
      tendencia: "unknown" as const,
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
  let tendencia: "sube" | "baja" | "estable" = "estable";
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

export function contextoLluvia(climaVentana: {
  semanas?: { precipitacion_mm?: number }[];
  fecha_eval?: Date | null;
} | null) {
  if (!climaVentana || !Array.isArray(climaVentana.semanas) || climaVentana.semanas.length === 0) {
    return {
      temporada_invernal: "unknown" as const,
      precip_mm_acum: null as number | null,
      nota: "Sin serie de precipitación. Regla C no genera ítems.",
    };
  }
  const acum = climaVentana.semanas.reduce(
    (s, w) => s + (Number(w.precipitacion_mm) || 0),
    0
  );
  const mes = climaVentana.fecha_eval ? climaVentana.fecha_eval.getMonth() + 1 : null;
  const invernalCal = mes != null && (mes <= 5 || mes === 12);
  const lluviaMaterial = acum >= 50;
  return {
    temporada_invernal: invernalCal,
    precip_mm_acum: Math.round(acum * 10) / 10,
    lluvia_material: lluviaMaterial,
    nota:
      "Regla C es cantonal (lluvia sin corte). Sin catálogo de barrios sin corte no se emiten ítems. " +
      `Precip. acum. 0–8 sem: ${Math.round(acum)} mm. Temporada invernal: ${invernalCal ? "sí" : "no"}.`,
  };
}

export function clasificarBarrio(
  barrio: BarrioInput,
  fechaEval: string | Date,
  contexto: { tendencia?: { tendencia: string } } = {}
): Clasificacion {
  const evalDate = typeof fechaEval === "string" ? parseFecha(fechaEval) : fechaEval;
  const fechaCorte = parseFecha(barrio.fecha_corte || barrio.fecha_inicio || undefined);
  const evidencias: Evidencia[] = [];
  const incertidumbre: string[] = [];
  const origen_dato: string[] = [];

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

  origen_dato.push("observado");
  const dias = diasEntre(fechaCorte, evalDate);
  const sem = semanasEntre(fechaCorte, evalDate);
  evidencias.push({ campo: "dias_desde_corte", valor: dias, origen: "derivado" });
  evidencias.push({
    campo: "semanas_desde_corte",
    valor: Math.round(sem * 10) / 10,
    origen: "derivado",
  });

  const { horas, origen: origenHoras, rango } = horasParaUmbral(barrio);
  if (horas == null) {
    incertidumbre.push("duracion_horas_desconocida");
  } else {
    evidencias.push({
      campo: "duracion_horas_umbral",
      valor: horas,
      origen: origenHoras,
      rango_observado: rango || (barrio.duracion_horas != null ? String(barrio.duracion_horas) : null),
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

  const cumpleA =
    horas != null && horas >= 8 && dias >= 0 && dias <= 14 && almacenar === true;

  if (cumpleA) {
    let puntaje = 80 + Math.min(15, Math.round(horas!));
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
      origen_dato: Array.from(new Set(origen_dato)),
      aplica_d: aplicaD,
      hipotesis: false,
      label_regla: "COLA ESTA SEMANA",
    };
  }

  const cumpleB = dias >= 7 && dias <= 14;
  if (cumpleB) {
    let puntaje = 35 + Math.round(14 - dias);
    if (aplicaD) puntaje += 5;
    return {
      regla: "B",
      accion: "Revisar recipientes con agua almacenada del corte (hipótesis, no hecho EC).",
      justificacion:
        `Corte hace ${dias} días (ventana 7–14 d = ciclo huevo→adulto de Aedes aegypti). ` +
        `No cumple A: ${horas == null ? "duración desconocida" : horas < 8 ? `duración ${horas} h < 8 h` : "sin pedido explícito de almacenar"}. ` +
        `Regla B = hipótesis biológica; NO validada con datos ecuatorianos en este proyecto ` +
        `(lags 0–20 sem de corte_hn sin efecto significativo en results/lag_effects.csv). ` +
        `Requiere confirmación humana antes de priorizar como hallazgo.`,
      puntaje,
      evidencias,
      incertidumbre: [
        ...incertidumbre,
        "regla_b_hipotesis_no_validada_ecuador",
        "regla_b_ventana_biologica_sin_calibrar",
        "regla_b_sin_metricas_no_existe_dengue_por_barrio",
      ],
      confianza: barrio.confianza || "B",
      origen_dato: Array.from(new Set([...origen_dato, "inferido"])),
      aplica_d: aplicaD,
      hipotesis: true,
      label_regla: "VENTANA DE CRIADERO (hipótesis)",
      requiere_confirmacion_humana: true,
    };
  }

  return {
    regla: null,
    accion: null,
    justificacion:
      dias < 0
        ? "Fecha de corte posterior a la evaluación."
        : dias > 14
          ? `Fuera de ventanas A (0–14 d) y B (7–14 d). Días desde corte: ${dias}.`
          : horas == null
            ? "Duración desconocida: no se puede aplicar umbral ≥8 h. Pendiente de validación."
            : "Corte de 0–6 días: aún dentro de A por fecha, pero sin ≥8 h y/o sin pedido de almacenar. No aplica A ni B.",
    puntaje: 0,
    evidencias,
    incertidumbre,
    confianza: barrio.confianza || "unknown",
    origen_dato: Array.from(new Set(origen_dato)),
    aplica_d: aplicaD,
    hipotesis: false,
  };
}

export function ordenarCola<T extends Clasificacion & { nombre?: string }>(items: T[]): T[] {
  const peso: Record<string, number> = { A: 3, B: 2, C: 1 };
  return [...items]
    .sort((a, b) => {
      const pa = peso[a.regla || ""] || 0;
      const pb = peso[b.regla || ""] || 0;
      if (pb !== pa) return pb - pa;
      if ((b.puntaje || 0) !== (a.puntaje || 0)) return (b.puntaje || 0) - (a.puntaje || 0);
      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
    })
    .map((item, i) => ({ ...item, prioridad: i + 1 }));
}
