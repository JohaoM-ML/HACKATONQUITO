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

export type ColaAPublica = {
  sector: string | null;
  accion: string | null;
  justificacion: string | null;
  prioridad: number | null;
  fecha_eval: string;
};

export type CortesPublicPayload = {
  ok: true;
  fuente: string;
  aviso: string;
  actualizado: string;
  cortes_recientes: CortePublico[];
  cola_regla_a: ColaAPublica[];
};

function truncate(text: string | null | undefined, max = JUSTIFICACION_MAX): string | null {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
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
  supabase: SupabaseClient = createPublicSupabase()
): Promise<CortesPublicPayload> {
  const [cortesRes, colaRes] = await Promise.all([
    supabase
      .from("cortes")
      .select("id, fecha_inicio, fecha_fin, duracion_horas, motivo, tipo_corte, fuente, sectores(nombre)")
      .order("fecha_inicio", { ascending: false })
      .limit(8),
    supabase
      .from("cola_items")
      .select("accion, justificacion, prioridad, fecha_eval, sectores(nombre)")
      .eq("regla", "A")
      .order("prioridad", { ascending: true })
      .limit(6),
  ]);

  if (cortesRes.error) throw new Error(cortesRes.error.message);
  if (colaRes.error) throw new Error(colaRes.error.message);

  const cortes_recientes: CortePublico[] = (cortesRes.data || []).map((row) => {
    const sectores = row.sectores as { nombre?: string } | { nombre?: string }[] | null;
    const sectorNombre = Array.isArray(sectores)
      ? sectores[0]?.nombre ?? null
      : sectores?.nombre ?? null;
    return {
      id: row.id as string,
      fecha_inicio: row.fecha_inicio as string,
      fecha_fin: (row.fecha_fin as string | null) ?? null,
      duracion_horas: (row.duracion_horas as string | null) ?? null,
      motivo: (row.motivo as string | null) ?? null,
      tipo_corte: (row.tipo_corte as string | null) ?? null,
      fuente: (row.fuente as string | null) ?? null,
      sector: sectorNombre,
    };
  });

  const cola_regla_a: ColaAPublica[] = (colaRes.data || []).map((row) => {
    const sectores = row.sectores as { nombre?: string } | { nombre?: string }[] | null;
    const sectorNombre = Array.isArray(sectores)
      ? sectores[0]?.nombre ?? null
      : sectores?.nombre ?? null;
    return {
      sector: sectorNombre,
      accion: (row.accion as string | null) ?? null,
      justificacion: truncate(row.justificacion as string | null),
      prioridad: (row.prioridad as number | null) ?? null,
      fecha_eval: row.fecha_eval as string,
    };
  });

  return {
    ok: true,
    fuente: "Anuncios Interagua (cortes) + cola operativa Regla A — VENTANA SECA",
    aviso:
      "Datos públicos de cortes de agua y cola operativa. No afirman ni garantizan reducción de casos de dengue.",
    actualizado: new Date().toISOString(),
    cortes_recientes,
    cola_regla_a,
  };
}

/** Mensaje corto en español para WhatsApp (Twilio / n8n). */
export function buildWhatsAppReply(data: CortesPublicPayload): string {
  const lineas: string[] = [
    "VENTANA SECA — info vecinos",
    "Cortes Interagua y cola operativa (no es un diagnóstico ni promesa de menos dengue).",
    "",
  ];

  if (data.cortes_recientes.length === 0) {
    lineas.push("Sin cortes recientes en la base.");
  } else {
    lineas.push("Cortes recientes:");
    for (const c of data.cortes_recientes.slice(0, 5)) {
      const sector = c.sector || "sector";
      const dur = c.duracion_horas ? ` · ${c.duracion_horas}` : "";
      lineas.push(`• ${sector}: ${c.fecha_inicio}${dur}`);
    }
  }

  if (data.cola_regla_a.length > 0) {
    lineas.push("");
    lineas.push("Prioridad operativa (Regla A):");
    for (const q of data.cola_regla_a.slice(0, 4)) {
      const sector = q.sector || "sector";
      const accion = q.accion || "revisar recipientes";
      const just = q.justificacion ? ` — ${q.justificacion}` : "";
      lineas.push(`• ${sector}: ${accion}${just}`);
    }
  }

  lineas.push("");
  lineas.push(
    "Consejo: tapa bien tanques, barriles y baldes con agua almacenada; limpia y elimina criaderos."
  );
  lineas.push(
    "Esto es información de cortes y tip doméstico; no garantiza prevenir casos de dengue."
  );

  return lineas.join("\n").slice(0, 1500);
}

export function wantsCortesInfo(body: string): boolean {
  const t = body
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /corte|agua|dengue|tanque|interagua|sector|aviso|info|hola|menu|ayuda/.test(t);
}
