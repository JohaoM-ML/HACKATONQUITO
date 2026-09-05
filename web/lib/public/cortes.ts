import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const JUSTIFICACION_MAX = 140;

export type CortePublico = {
  id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  duracion_horas: string | null;
  motivo: string | null;
  tipo_corte: string | null;
  fuente: string | null;
  sector: string | null;
};

export type ColaZonaPublica = {
  regla: "A" | "B";
  sector: string | null;
  accion: string | null;
  justificacion: string | null;
  prioridad: number | null;
  fecha_eval: string;
  hipotesis: boolean;
  aviso_vecino: string;
};

/** @deprecated usar ColaZonaPublica; se mantiene por compatibilidad */
export type ColaAPublica = ColaZonaPublica;

export type MiZonaPublica = {
  regla: "A" | "B" | null;
  sector: string;
  aviso_vecino: string;
};

export type CortesPublicPayload = {
  ok: true;
  fuente: string;
  aviso: string;
  actualizado: string;
  cortes_recientes: CortePublico[];
  cola_regla_a: ColaZonaPublica[];
  cola_regla_b: ColaZonaPublica[];
  mi_zona?: MiZonaPublica;
};

function truncate(text: string | null | undefined, max = JUSTIFICACION_MAX): string | null {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export function normalizarSector(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Comunicado formal por zona. No promete dengue ni fumigación. */
export function buildAvisoVecino(regla: "A" | "B", sector: string | null): string {
  const s = sector?.trim() || "su sector";
  if (regla === "A") {
    return (
      `AVISO — Sector ${s}. Se informa que esta semana hay corte de agua o solicitud de almacenamiento en su sector. ` +
      `Recomendación sanitaria: cubra tanques y vacíe baldes o llantas. Personal de brigada podría inspeccionar recipientes. ` +
      `Este comunicado no confirma fumigación ni reducción de dengue.`
    );
  }
  return (
    `AVISO — Sector ${s}. Se recomienda revisar recipientes en el hogar ` +
    `(ventana de 7 a 14 días posteriores al corte; hipótesis no validada en Ecuador). ` +
    `Este aviso no programa visita de brigada ni confirma fumigación. Si hay inspección, se solicita su colaboración. ` +
    `No garantiza evitar enfermedad.`
  );
}

function sectorNombreDeJoin(sectores: { nombre?: string } | { nombre?: string }[] | null): string | null {
  if (Array.isArray(sectores)) return sectores[0]?.nombre ?? null;
  return sectores?.nombre ?? null;
}

function mapColaRow(
  row: {
    regla?: string | null;
    accion: string | null;
    justificacion: string | null;
    prioridad: number | null;
    fecha_eval: string;
    sectores: { nombre?: string } | { nombre?: string }[] | null;
  },
  fallback: "A" | "B"
): ColaZonaPublica {
  const regla = row.regla === "B" ? "B" : row.regla === "A" ? "A" : fallback;
  const sector = sectorNombreDeJoin(row.sectores);
  return {
    regla,
    sector,
    accion: row.accion,
    justificacion: truncate(row.justificacion),
    prioridad: row.prioridad,
    fecha_eval: row.fecha_eval,
    hipotesis: regla === "B",
    aviso_vecino: buildAvisoVecino(regla, sector),
  };
}

export function coincideSector(query: string, nombre: string | null | undefined): boolean {
  const q = normalizarSector(query);
  const n = normalizarSector(nombre || "");
  if (!q || !n) return false;
  return n.includes(q) || q.includes(n);
}

export function lookupZonaVecino(
  data: Pick<CortesPublicPayload, "cola_regla_a" | "cola_regla_b">,
  sector: string
): MiZonaPublica {
  const q = sector.trim();
  const hitA = data.cola_regla_a.find((x) => coincideSector(q, x.sector));
  if (hitA) {
    return { regla: "A", sector: hitA.sector || q, aviso_vecino: hitA.aviso_vecino };
  }
  const hitB = data.cola_regla_b.find((x) => coincideSector(q, x.sector));
  if (hitB) {
    return { regla: "B", sector: hitB.sector || q, aviso_vecino: hitB.aviso_vecino };
  }
  return {
    regla: null,
    sector: q,
    aviso_vecino:
      `Sector ${q}: no figura hoy en la cola de avisos. ` +
      `Recomendación general: cubra tanques y vacíe recipientes. ` +
      `Este comunicado no promete visita, fumigación ni reducción de dengue.`,
  };
}

/** Service role if available (RLS blocks anon on cortes/cola); else anon. */
export function createPublicSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anon;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function fetchCortesPublicos(
  supabase: SupabaseClient = createPublicSupabase(),
  opts: { sector?: string } = {}
): Promise<CortesPublicPayload> {
  const [cortesRes, colaRes] = await Promise.all([
    supabase
      .from("cortes")
      .select("id, fecha_inicio, fecha_fin, duracion_horas, motivo, tipo_corte, fuente, sectores(nombre)")
      .order("fecha_inicio", { ascending: false })
      .limit(8),
    supabase
      .from("cola_items")
      .select("regla, accion, justificacion, prioridad, fecha_eval, sectores(nombre)")
      .in("regla", ["A", "B"])
      .order("prioridad", { ascending: true })
      .limit(16),
  ]);

  if (cortesRes.error) throw new Error(cortesRes.error.message);
  if (colaRes.error) throw new Error(colaRes.error.message);

  const cortes_recientes: CortePublico[] = (cortesRes.data || []).map((row) => ({
    id: row.id as string,
    fecha_inicio: row.fecha_inicio as string,
    fecha_fin: (row.fecha_fin as string | null) ?? null,
    duracion_horas: (row.duracion_horas as string | null) ?? null,
    motivo: (row.motivo as string | null) ?? null,
    tipo_corte: (row.tipo_corte as string | null) ?? null,
    fuente: (row.fuente as string | null) ?? null,
    sector: sectorNombreDeJoin(row.sectores as { nombre?: string } | { nombre?: string }[] | null),
  }));

  const cola = (colaRes.data || []).map((row) =>
    mapColaRow(
      {
        regla: row.regla as string | null,
        accion: (row.accion as string | null) ?? null,
        justificacion: (row.justificacion as string | null) ?? null,
        prioridad: (row.prioridad as number | null) ?? null,
        fecha_eval: row.fecha_eval as string,
        sectores: row.sectores as { nombre?: string } | { nombre?: string }[] | null,
      },
      "A"
    )
  );

  const cola_regla_a = cola.filter((x) => x.regla === "A").slice(0, 8);
  const cola_regla_b = cola.filter((x) => x.regla === "B").slice(0, 8);

  const payload: CortesPublicPayload = {
    ok: true,
    fuente: "Anuncios Interagua (cortes) + cola operativa de zonas riesgosas — ZANKU",
    aviso:
      "A = cola de esta semana (posible visita para revisar recipientes). " +
      "B = ventana de cuidado 7–14 días post-corte (hipótesis; no entra sola a la ruta). " +
      "No afirman fumigación, diagnóstico ni reducción de dengue.",
    actualizado: new Date().toISOString(),
    cortes_recientes,
    cola_regla_a,
    cola_regla_b,
  };

  const sector = opts.sector?.trim();
  if (sector) {
    payload.mi_zona = lookupZonaVecino(payload, sector);
  }

  return payload;
}

/** Mensaje corto en español para WhatsApp (Twilio / n8n). */
export function buildWhatsAppReply(data: CortesPublicPayload): string {
  const lineas: string[] = [
    "ZANKU — Aviso a la ciudadanía",
    "Información de cortes de agua e indicaciones preventivas. No constituye diagnóstico ni promesa de reducción de dengue.",
    "",
  ];

  if (data.mi_zona) {
    lineas.push(data.mi_zona.aviso_vecino);
    lineas.push("");
  }

  if (data.cortes_recientes.length === 0) {
    lineas.push("Sin cortes recientes en la base.");
  } else {
    lineas.push("Cortes recientes:");
    for (const c of data.cortes_recientes.slice(0, 4)) {
      const sector = c.sector || "sector";
      const dur = c.duracion_horas ? ` · ${c.duracion_horas}` : "";
      lineas.push(`• ${sector}: ${c.fecha_inicio}${dur}`);
    }
  }

  if (data.cola_regla_a.length > 0) {
    lineas.push("");
    lineas.push("Zonas riesgosas prioritarias:");
    for (const q of data.cola_regla_a.slice(0, 4)) {
      lineas.push(`• ${q.sector || "sector"}`);
    }
  }

  if (data.cola_regla_b.length > 0) {
    lineas.push("");
    lineas.push("Zona B (cuidado en casa; hipótesis, no ruta ni fumigación):");
    for (const q of data.cola_regla_b.slice(0, 4)) {
      lineas.push(`• ${q.sector || "sector"}`);
    }
  }

  lineas.push("");
  lineas.push("Recomendación: cubra tanques y vacíe baldes o llantas. Este aviso no garantiza prevenir dengue.");

  return lineas.join("\n").slice(0, 1500);
}

export function wantsCortesInfo(body: string): boolean {
  const t = body
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /corte|agua|dengue|tanque|interagua|sector|aviso|info|hola|menu|ayuda|brigada|fumig|zona/.test(t);
}
