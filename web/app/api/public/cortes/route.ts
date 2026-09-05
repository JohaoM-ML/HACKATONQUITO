import { NextResponse } from "next/server";
import { fetchCortesPublicos } from "@/lib/public/cortes";

/**
 * GET /api/public/cortes
 * Público (sin auth) para n8n / WhatsApp vecinos.
 * Cortes Interagua + cola A/B. Query opcional ?sector= para aviso del barrio.
 * No afirma reducción de dengue ni fumigación.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "public, max-age=60",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: Request) {
  try {
    const sector = new URL(req.url).searchParams.get("sector") || undefined;
    const payload = await fetchCortesPublicos(undefined, { sector });
    return NextResponse.json(payload, { headers: corsHeaders });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "error",
        aviso:
          "No se pudieron leer cortes/cola. Revisa SUPABASE_SERVICE_ROLE_KEY (RLS exige auth para anon).",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
