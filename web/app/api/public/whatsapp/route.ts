import { NextResponse } from "next/server";
import {
  buildWhatsAppReply,
  fetchCortesPublicos,
  wantsCortesInfo,
} from "@/lib/public/cortes";

/**
 * POST /api/public/whatsapp — fallback Twilio webhook (TwiML).
 *
 * Camino preferido: n8n (Twilio → n8n → GET /api/public/cortes → reply).
 * Usa este endpoint solo si n8n no está disponible: apunta el webhook
 * de Twilio WhatsApp aquí.
 *
 * Twilio envía application/x-www-form-urlencoded (Body, From, …).
 */
function twiml(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/public/whatsapp",
    preferido: "n8n workflow (n8n/whatsapp-vecinos.json)",
    uso: "Fallback Twilio → TwiML si n8n no está disponible",
  });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let bodyText = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      bodyText = String(form.get("Body") || "");
    } else if (contentType.includes("application/json")) {
      const json = (await req.json()) as { Body?: string; body?: string };
      bodyText = String(json.Body || json.body || "");
    } else {
      const raw = await req.text();
      const params = new URLSearchParams(raw);
      bodyText = params.get("Body") || "";
    }

    let message: string;
    if (!bodyText.trim() || wantsCortesInfo(bodyText)) {
      const data = await fetchCortesPublicos();
      message = buildWhatsAppReply(data);
    } else {
      message =
        "ZANKU — escribe *cortes*, *agua* o *info* para ver anuncios de cortes Interagua y tip de tanques. No prometemos reducción de dengue.";
    }

    return new NextResponse(twiml(message), {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  } catch (e) {
    const errMsg =
      "ZANKU: no pude consultar cortes ahora. Intenta más tarde. (Fallback sin n8n)";
    console.error("[whatsapp fallback]", e instanceof Error ? e.message : e);
    return new NextResponse(twiml(errMsg), {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }
}
