const pptxgen = require("pptxgenjs");

const NAVY = "0B2744";
const NAVY_DEEP = "081C33";
const ICE = "D5E8F6";
const INK = "0B2744";
const MUTED = "4D6578";
const AMBER = "C97820";
const ROW_ALT = "F4F9FC";
const WHITE = "FFFFFF";
const SERIF = "Georgia";
const SANS = "Calibri";

const pres = new pptxgen();
pres.defineLayout({ name: "WIDE16", width: 13.333, height: 7.5 });
pres.layout = "WIDE16";
pres.title = "ZANKU — Sostenibilidad financiera · Guayaquil";
pres.author = "ZANKU / VENTANA SECA";
pres.subject = "Costos de implementación en Guayaquil · WhatsApp Business app · sin Twilio";

function header(slide, title, subtitle) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.333, h: 1.18,
    fill: { color: NAVY }, line: { color: NAVY },
  });
  slide.addText(title, {
    x: 0.42, y: 0.14, w: 12.5, h: 0.5,
    fontFace: SERIF, fontSize: 28, bold: true, color: WHITE, margin: 0,
  });
  slide.addText(subtitle, {
    x: 0.42, y: 0.64, w: 12.5, h: 0.44,
    fontFace: SANS, fontSize: 13, color: ICE, margin: 0,
  });
}

function footer(slide, runs) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 6.42, w: 13.333, h: 1.08,
    fill: { color: NAVY_DEEP }, line: { color: NAVY_DEEP },
  });
  slide.addText(runs, {
    x: 0.42, y: 6.5, w: 12.5, h: 0.92,
    fontFace: SANS, fontSize: 13, color: WHITE, valign: "middle", margin: 0,
  });
}

function pill(slide, x, y, w, label) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h: 0.32,
    fill: { color: ICE }, line: { color: ICE }, rectRadius: 0.06,
  });
  slide.addText(label, {
    x, y, w, h: 0.32,
    fontFace: SANS, fontSize: 10, bold: true, color: NAVY,
    align: "center", valign: "middle", margin: 0,
  });
}

function card(slide, x, y, w, h, title, body) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: ICE }, line: { color: ICE }, rectRadius: 0.08,
  });
  slide.addText(title, {
    x: x + 0.14, y: y + 0.1, w: w - 0.28, h: 0.28,
    fontFace: SANS, fontSize: 13, bold: true, color: INK, margin: 0,
  });
  slide.addText(body, {
    x: x + 0.14, y: y + 0.4, w: w - 0.28, h: h - 0.5,
    fontFace: SANS, fontSize: 11, color: INK, margin: 0,
  });
}

function cell(title, hint, opts = {}) {
  return {
    text: [
      { text: title, options: { bold: true, fontSize: 12, color: INK, breakLine: true } },
      { text: hint, options: { fontSize: 10, color: MUTED } },
    ],
    options: { valign: "top", align: "left", fill: { color: opts.fill || WHITE } },
  };
}

function moneyCell(text, opts = {}) {
  return {
    text,
    options: {
      bold: true,
      fontSize: 13,
      color: opts.amber ? AMBER : INK,
      align: "right",
      valign: "middle",
      fill: { color: opts.fill || WHITE },
    },
  };
}

function headCell(text, align) {
  return {
    text,
    options: {
      bold: true,
      fontSize: 12,
      color: WHITE,
      fill: { color: NAVY },
      align: align || "left",
      valign: "middle",
    },
  };
}

/* ========== SLIDE 1 ========== */
const s1 = pres.addSlide();
s1.background = { color: WHITE };
header(
  s1,
  "Sostenibilidad financiera",
  "No solo es barato — genera algo que hoy no existe: evidencia propia de qué funciona. Canal ciudadano: app WhatsApp Business (la verde), no Twilio ni Cloud API.",
);

card(
  s1, 0.4, 1.28, 4.1, 1.22,
  "Rutas optimizadas",
  "La misma brigada cubre más manzanas de riesgo, sin contratar más personal. En Guayaquil ya recorren ~150 manzanas/día: ZANKU reordena, no duplica nómina.",
);
card(
  s1, 4.62, 1.28, 4.1, 1.22,
  "Evidencia propia, por vivienda",
  "Cada visita registra qué acción se hizo — tapar, larvicida, malla — y el resultado en la reinspección. El HI/CI/BI sale del campo, no de Twilio.",
);
card(
  s1, 8.84, 1.28, 4.1, 1.22,
  "Decide con datos, no a ciegas",
  "Por primera vez el municipio sabe qué intervención reduce más rápido el riesgo en cada tipo de barrio — y el tip del corte sale del panel al WhatsApp del jefe.",
);

pill(s1, 0.4, 2.6, 4.55, "1. IMPLEMENTACIÓN + CAPACITACIÓN  ·  PAGO ÚNICO");
pill(s1, 5.08, 2.6, 3.7, "2. LICENCIA ANUAL  ·  PAGO RECURRENTE");

s1.addTable(
  [
    [
      headCell("Componente"),
      headCell("Tu costo real", "right"),
      headCell("Precio sugerido", "right"),
    ],
    [
      cell(
        "Implementación + capacitación",
        "Endurecer app (RLS, backups) · convenio LOPDP · diccionario Interagua · 2 jornadas · perfil WhatsApp Business. Fee Meta = $0.",
      ),
      moneyCell("$2.000 – $5.200"),
      moneyCell("$4.000 – $7.000", { amber: true }),
    ],
    [
      cell(
        "Licencia anual",
        "Base hasta 10 brigadistas. Vercel + Supabase + ~20 h/mes. Las brigadas las pone el Municipio / MSP — no van en esta línea.",
        { fill: ROW_ALT },
      ),
      moneyCell("$4.100 – $8.000/año", { fill: ROW_ALT }),
      moneyCell("$10.000 – $15.000/año", { amber: true, fill: ROW_ALT }),
    ],
    [
      cell(
        "WhatsApp Business (app, no API)",
        "El panel copia el aviso; el jefe lo pega en la app verde. $0/mensaje. Lista de difusión: máx. 256. Se escala por líder de sector.",
      ),
      moneyCell("$0 / aviso · $0–192/año"),
      moneyCell("Incluido", { amber: true }),
    ],
    [
      cell(
        "Por brigadista adicional",
        "Supabase Pro cubre 100 mil MAU. Un brigadista más no abre servidor ni licencia de WhatsApp.",
        { fill: ROW_ALT },
      ),
      moneyCell("Casi $0 extra real", { fill: ROW_ALT }),
      moneyCell("$150 – $300/año c/u", { amber: true, fill: ROW_ALT }),
    ],
  ],
  {
    x: 0.4,
    y: 3.02,
    w: 12.54,
    colW: [7.34, 2.6, 2.6],
    border: [
      { pt: 0, color: WHITE },
      { pt: 0.5, color: "E4EEF5" },
      { pt: 0, color: WHITE },
      { pt: 0.5, color: "E4EEF5" },
    ],
    fontFace: SANS,
    valign: "middle",
  },
);

s1.addText(
  "Infraestructura real verificada (Guayaquil, sep 2026): Vercel Pro $20/mes + Supabase Pro $25/mes + dominio $15/año + WhatsApp Business app $0/mensaje (número municipal $0, o línea dedicada $16/mes) ≈ $555–$750/año. Sin Twilio, sin Cloud API, sin n8n. El resto del costo es mantenimiento humano, no servidores.",
  {
    x: 0.42, y: 5.78, w: 12.5, h: 0.56,
    fontFace: SANS, fontSize: 11, italic: true, color: MUTED, margin: 0,
  },
);

footer(s1, [
  {
    text: "Un distrito piloto cuesta $14.000–$22.000 el primer año ",
    options: { bold: true },
  },
  {
    text: "(implementación + 1ª licencia). El Municipio de Guayaquil ya gasta entre $120.000 y $200.000 al año solo en toldos mosquiteros (40.000 unidades/año) — ZANKU completo es ",
  },
  { text: "menos del 15%", options: { bold: true, color: AMBER } },
  { text: " de un solo insumo que ya compran. No se contrata una segunda brigada." },
]);

/* ========== SLIDE 2 ========== */
const s2 = pres.addSlide();
s2.background = { color: WHITE };
header(
  s2,
  "Desglose real · cantón Guayaquil",
  "3.007.696 habitantes (INEC 2026) · 16 parroquias urbanas. El software casi no se mueve al pasar de un distrito a la ciudad. El salto lo hace el personal — y solo si decides pagarlo tú.",
);

pill(s2, 0.4, 1.32, 3.55, "CAPA SOBRE BRIGADAS EXISTENTES");
pill(s2, 4.08, 1.32, 3.15, "WHATSAPP BUSINESS  ·  $0 / AVISO");

s2.addTable(
  [
    [
      headCell("Modelo de implementación"),
      headCell("Quién paga al brigadista"),
      headCell("Costo año 1 (sin IVA)", "right"),
    ],
    [
      cell(
        "Capa software",
        "Vercel + Supabase + número municipal de WhatsApp Business. El jefe del centro pega el aviso. Mes 0: endurecer app y 1 jornada.",
      ),
      {
        text: "Municipio / MSP (ya existe)",
        options: { fontSize: 12, color: INK, align: "left", valign: "middle", fill: { color: WHITE } },
      },
      moneyCell("~$2.500 – $4.200", { amber: true }),
    ],
    [
      cell(
        "Equipo de proyecto",
        "Lo que conviene cotizar: 1 coordinador ($1.200 bruto → $1.524 cargado) + 20 h/mes de Next.js + línea dedicada $16/mes. Piloto 3 meses ≈ $12.000.",
        { fill: ROW_ALT },
      ),
      {
        text: "Municipio / MSP (ya existe)",
        options: { fontSize: 12, color: INK, align: "left", valign: "middle", fill: { color: ROW_ALT } },
      },
      moneyCell("~$32.000", { amber: true, fill: ROW_ALT }),
    ],
    [
      cell(
        "Brigada propia",
        "15 brigadistas × $700 + 1 jefe × $1.400 + IESS/13º/14º + transporte. Quitar Twilio no baja esto: es nómina, no mensajes. El pitch no pide esto.",
      ),
      {
        text: "Tú · 16 contratos nuevos",
        options: { fontSize: 12, color: INK, align: "left", valign: "middle", fill: { color: WHITE } },
      },
      moneyCell("~$230.000", { amber: true }),
    ],
  ],
  {
    x: 0.4,
    y: 1.76,
    w: 12.54,
    colW: [6.4, 3.44, 2.7],
    border: [
      { pt: 0, color: WHITE },
      { pt: 0.5, color: "E4EEF5" },
      { pt: 0, color: WHITE },
      { pt: 0.5, color: "E4EEF5" },
    ],
    fontFace: SANS,
  },
);

card(
  s2, 0.4, 4.12, 7.35, 2.18,
  "SaaS mensual (el mismo de 1 distrito o de 16 parroquias)",
  "Vercel Pro $20 + Supabase Pro $25 + dominio $1,25 ≈ $46/mes.\nWhatsApp Business: $0/aviso · $0 si usan el número del centro · $16 si hay línea ZANKU.\nTope operativo: 256 contactos por lista de difusión. Grupos de barrio: sin tope, hay que moderar.\nChat 1:1 a 15 mil hogares no cabe en la app. Automatizar la app (Baileys / “API no oficial”) no está en esta cuenta.",
);
card(
  s2, 7.9, 4.12, 5.04, 2.18,
  "Contra qué se paga solo",
  "Un día de 16 personas mal dirigidas ≈ $320. El stack de ~$46–62/mes se paga si evitas ese día una vez cada cuatro meses.\nEl Municipio ya hizo 268 mil intervenciones ene–jul 2026. ZANKU no compra motomochilas: compra que las 150 manzanas del día sean las del corte de Interagua.",
);

footer(s2, [
  { text: "Precio al Municipio (diapositiva 1): ", options: {} },
  { text: "$14.000–$22.000", options: { bold: true } },
  { text: " el primer distrito. Costo interno si solo se vende la capa: " },
  { text: "~$3.200/año", options: { bold: true } },
  { text: ". Si el proyecto pone coordinador: " },
  { text: "~$32.000/año", options: { bold: true } },
  { text: ". Recrear la brigada: no. IVA 15% solo sobre SaaS y honorarios si se factura a RUC." },
]);

const out = __dirname + "/ZANKU-sostenibilidad-financiera-Guayaquil.pptx";
pres.writeFile({ fileName: out }).then(() => {
  console.log("Wrote", out);
});
