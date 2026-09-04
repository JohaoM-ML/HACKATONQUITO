/*
 * Genera un informe HTML autónomo (un solo archivo, sin dependencias ni
 * internet) a partir del canvas de análisis del hackatón.
 *
 * Uso:  node generar-informe.js
 *
 * Los arreglos de datos se extraen directamente del .canvas.tsx para que el
 * informe no se desincronice del análisis original. La prosa de las secciones
 * se mantiene aquí porque en el canvas vive dentro de JSX.
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".cursor",
  "projects",
  "c-Users-USER-OneDrive-Escritorio-2026-2-HACKATON-QUITO",
  "canvases",
  "hackaton-el-nino-analisis.canvas.tsx",
);
const OUT = path.join(__dirname, "informe-hackaton-el-nino.html");

const src = fs.readFileSync(SRC, "utf8");

/* ------------------------------------------------ extracción de datos ---- */

function arr(name) {
  const re = new RegExp("const " + name + "(?::[^=]*)? = (\\[[\\s\\S]*?\\n\\]);");
  const m = src.match(re);
  if (!m) throw new Error("No se encontró el arreglo: " + name);
  // eslint-disable-next-line no-eval
  return eval("(" + m[1] + ")");
}

const EVIDENCE = arr("EVIDENCE");
const PROBLEMS = arr("PROBLEMS");
const RANKED = arr("RANKED");
const SOLUTIONS = arr("SOLUTIONS");
const ARCH_ROWS = arr("ARCH_ROWS");
const PLAN_ROWS = arr("PLAN_ROWS");
const METRIC_ROWS = arr("METRIC_ROWS");
const TRACK_DAMAGE = arr("TRACK_DAMAGE");
const CRITERIA = arr("CRITERIA");
const CRITERIA_FULL = arr("CRITERIA_FULL");

const STRENGTH_LABEL = {
  fuerte: "Evidencia fuerte",
  moderada: "Evidencia moderada",
  limitada: "Evidencia limitada",
  hipotesis: "Hipótesis",
};

const totalOf = (s) => s.reduce((a, b) => a + b, 0);
const norm = (s) => Math.round((totalOf(s) / 130) * 100);

/* ----------------------------------------------------------- helpers ---- */

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const h2 = (t, id) => `<h2${id ? ` id="${id}"` : ""}>${esc(t)}</h2>`;
const h3 = (t) => `<h3>${esc(t)}</h3>`;
const h4 = (t) => `<h4>${esc(t)}</h4>`;
const p = (t) => `<p>${esc(t)}</p>`;
const lead = (t) => `<p class="lead">${esc(t)}</p>`;
const note = (t) => `<p class="note">${esc(t)}</p>`;
const quote = (t) => `<blockquote>${esc(t)}</blockquote>`;

function callout(tone, title, body) {
  return `<div class="callout ${tone}"><div class="callout-title">${esc(title)}</div><div>${esc(body)}</div></div>`;
}

function table(headers, rows, opts = {}) {
  const tones = opts.rowTone || [];
  const align = opts.align || [];
  const th = headers
    .map((hh, i) => `<th${align[i] ? ` class="a-${align[i]}"` : ""}>${esc(hh)}</th>`)
    .join("");
  const tr = rows
    .map((r, ri) => {
      const td = r
        .map((c, i) => `<td${align[i] ? ` class="a-${align[i]}"` : ""}>${esc(c)}</td>`)
        .join("");
      return `<tr${tones[ri] ? ` class="t-${tones[ri]}"` : ""}>${td}</tr>`;
    })
    .join("");
  return `<div class="tw"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function card(title, tag, bodyHtml) {
  return `<details class="card"${tag === "__open" ? " open" : ""}>
<summary><span>${esc(title)}</span>${tag && tag !== "__open" ? `<em>${esc(tag)}</em>` : ""}</summary>
<div class="card-body">${bodyHtml}</div></details>`;
}

function stats(items) {
  return `<div class="stats">${items
    .map(
      (s) =>
        `<div class="stat t-${s.tone || "neutral"}"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`,
    )
    .join("")}</div>`;
}

/** Barras horizontales en CSS puro, sin librerías. */
function barChart(items, opts = {}) {
  const max = opts.max || Math.max(...items.map((i) => i.value));
  const fmt = opts.fmt || ((v) => String(v));
  return `<div class="bars">${items
    .map(
      (i) => `<div class="bar-row">
<span class="bar-label">${esc(i.label)}</span>
<span class="bar-track"><span class="bar-fill t-${i.tone || "accent"}" style="width:${(i.value / max) * 100}%"></span></span>
<span class="bar-value">${esc(fmt(i.value))}</span>
</div>`,
    )
    .join("")}</div>`;
}

/** Barras agrupadas de dos series. */
function groupedBars(rows, nameA, nameB, max) {
  return `<div class="legend"><span><i class="sw a"></i>${esc(nameA)}</span><span><i class="sw b"></i>${esc(nameB)}</span></div>
<div class="bars">${rows
    .map(
      (r) => `<div class="bar-row grouped">
<span class="bar-label">${esc(r[0])}</span>
<span class="bar-track dual">
  <span class="bar-fill a" style="width:${(r[1] / max) * 100}%"></span>
  <span class="bar-fill b" style="width:${(r[2] / max) * 100}%"></span>
</span>
<span class="bar-value">${r[1]} · ${r[2]}</span>
</div>`,
    )
    .join("")}</div>`;
}

/** Dona en conic-gradient, sin librerías. */
function donut(slices) {
  const sum = slices.reduce((a, s) => a + s.value, 0);
  let acc = 0;
  const stops = slices
    .map((s) => {
      const from = (acc / sum) * 100;
      acc += s.value;
      const to = (acc / sum) * 100;
      return `var(--${s.tone}) ${from}% ${to}%`;
    })
    .join(", ");
  return `<div class="donut-wrap">
<div class="donut" style="background:conic-gradient(${stops})"></div>
<ul class="donut-legend">${slices
    .map(
      (s) =>
        `<li><i class="sw" style="background:var(--${s.tone})"></i>${esc(s.label)} <b>${((s.value / sum) * 100).toFixed(1)}%</b></li>`,
    )
    .join("")}</ul></div>`;
}

/* ---------------------------------------------------------- secciones ---- */

const sections = [];
const add = (id, title, html) => sections.push({ id, title, html });

/* --- 1. Contexto ---------------------------------------------------- */
add(
  "contexto",
  "Contexto y tesis",
  [
    callout(
      "warning",
      "La ventana de preparación es ahora",
      "El CPC/NOAA estima más del 90% de probabilidad de un evento muy fuerte y cerca de 69% de probabilidad de un evento históricamente sin precedentes para octubre-diciembre de 2026, con anomalías ya observadas de +2,9 °C en la región Niño 1+2. El ERFEN de Ecuador ubica la mayor expresión entre noviembre y diciembre. El Anticipation Hub advierte que en Ecuador y Perú la preparación de la temporada de lluvias debe iniciarse antes de noviembre. Al mismo tiempo, ENFEN proyecta magnitud moderada. Esa divergencia entre fuentes oficiales no es ruido: es un problema documentado que ya paralizó decisiones en 2017.",
    ),
    h3("La tesis de este análisis"),
    lead(
      "Después de revisar la literatura y el estado institucional real de Ecuador, el hallazgo central es incómodo para un hackatón: los sistemas que parecen faltar en realidad ya existen, y los que existen fallan por razones que ninguna aplicación resuelve. INAMHI ya opera un pronóstico hidrológico nacional a quince días sobre 2.300 tramos de río. La malla de comunicación offline ya existe, es abierta y cuesta menos de veinte dólares por nodo. Las apps de reporte ciudadano ya se probaron y se sabe, con números, que mueren a los cincuenta días.",
    ),
    lead(
      "Lo que sí falta es de otro tipo: nadie está conectando datos operativos que ya se publican con las decisiones que dependen de ellos. El caso más nítido y con mejor respaldo científico es el de la empresa de agua potable, que publica con días de anticipación y con resolución de barrio el mapa exacto de dónde miles de hogares van a llenar recipientes destapados —y a veces se lo ordena explícitamente— mientras el sector salud programa sus brigadas de control vectorial mirando la lluvia y los casos ya notificados.",
    ),
    h3("Magnitud del problema sanitario, antes de que llegue la lluvia"),
    stats([
      { value: "28.652", label: "Casos de dengue en Ecuador a mediados de agosto de 2026", tone: "danger" },
      { value: "35", label: "Fallecidos por dengue en 2026", tone: "danger" },
      { value: "11", label: "Semanas consecutivas por encima de 2025", tone: "warning" },
      { value: "91,5%", label: "Resistencia de Ae. aegypti a deltametrina", tone: "danger" },
    ]),
    note(
      "Fuente: Ministerio de Salud Pública del Ecuador, corte 15-ago-2026; resistencia según gaceta INSPI con información hasta junio de 2025.",
    ),
    h4("Severidad clínica de los casos de dengue de 2026"),
    donut([
      { label: "Sin signos de alarma (19.808)", value: 19808, tone: "neutral" },
      { label: "Con signos de alarma (3.301)", value: 3301, tone: "warning" },
      { label: "Dengue grave (197)", value: 197, tone: "danger" },
    ]),
    note(
      "Número de casos notificados. Fuente: registros oficiales del MSP hasta la semana epidemiológica 28 de 2026 (total 23.306 casos).",
    ),
    h4("Capacidad de observación hidrometeorológica de INAMHI"),
    barChart(
      [
        { label: "Antes de 2010", value: 230, tone: "neutral" },
        { label: "Desactivadas", value: 140, tone: "danger" },
        { label: "Activas hoy", value: 90, tone: "warning" },
        { label: "Con alianzas", value: 170, tone: "info" },
      ],
      { fmt: (v) => v + " est." },
    ),
    note(
      "Número de estaciones hidrometeorológicas. Fuente: declaraciones del jefe de pronósticos y alertas de INAMHI (El Comercio) e informe de la Contraloría General del Estado. Varias de las estaciones perdidas fueron vandalizadas en Esmeraldas y Guayas.",
    ),
    callout(
      "info",
      "Nota metodológica sobre las fuentes",
      "El servidor de búsqueda académica funcionó durante la primera parte de la investigación y luego se desconectó de forma permanente. Las primeras consultas se hicieron con él sobre OpenAlex, Crossref y PubMed; el resto de la evidencia se recuperó por investigación web, que alcanzó los mismos artículos revisados por pares. Toda la evidencia está etiquetada por fuerza, y las inferencias propias están marcadas como hipótesis y no como hallazgos.",
    ),
    quote(
      "Las cifras cuantitativas de esta sección provienen de fuentes oficiales y de literatura revisada por pares. Las puntuaciones de la matriz de priorización son juicio analítico propio, explícitamente subjetivo, y se muestran desagregadas por criterio para que puedan ser discutidas y modificadas.",
    ),
  ].join("\n"),
);

/* --- 2. Evidencia --------------------------------------------------- */
add(
  "evidencia",
  "Evidencia académica",
  [
    lead(
      `${EVIDENCE.length} hallazgos que sostienen todo el análisis. No es una bibliografía: cada entrada existe porque cambia una decisión de diseño. Se incluye deliberadamente evidencia negativa, es decir, estudios que demuestran que un enfoque popular no funciona.`,
    ),
    ...EVIDENCE.map((e, i) =>
      card(
        e.hallazgo.length > 120 ? e.hallazgo.slice(0, 120) + "…" : e.hallazgo,
        i < 3 ? "__open" : STRENGTH_LABEL[e.fuerza],
        [
          h4("Hallazgo"),
          p(e.hallazgo),
          h4("Fuente"),
          p(e.fuente),
          h4("Relevancia"),
          p(e.relevancia),
          h4("Implicación tecnológica"),
          p(e.implicacion),
          `<p class="tag t-${e.fuerza === "fuerte" ? "success" : e.fuerza === "moderada" ? "info" : "warning"}">${esc(STRENGTH_LABEL[e.fuerza])}</p>`,
        ].join("\n"),
      ),
    ),
  ].join("\n"),
);

/* --- 3. Problemas --------------------------------------------------- */
add(
  "problemas",
  "Fases 1-2 · Problemas",
  [
    h3("Fase 1 — Problemas concretos, con anatomía completa"),
    lead(
      "Trece problemas descompuestos en usuario afectado, actor que hoy intenta resolverlo, causa, consecuencia, momento crítico, información que falta, decisión que se toma mal o tarde, y tecnología candidata. La etiqueta indica si el problema está respaldado por evidencia o si todavía es una hipótesis nuestra.",
    ),
    ...PROBLEMS.map((pr) =>
      card(
        `${pr.id} · ${pr.track} · ${pr.titulo}`,
        pr.id === "P1" ? "__open" : STRENGTH_LABEL[pr.estado],
        table(
          ["Dimensión", "Detalle"],
          [
            ["Usuario afectado", pr.usuario],
            ["Quién intenta resolverlo hoy", pr.actor],
            ["Causa", pr.causa],
            ["Consecuencia", pr.consecuencia],
            ["Momento crítico", pr.momento],
            ["Información que falta", pr.faltaInfo],
            ["Decisión que se toma mal o tarde", pr.malaDecision],
            ["Tecnología candidata", pr.tecnologia],
            ["Fuerza de la evidencia", STRENGTH_LABEL[pr.estado]],
          ],
        ),
      ),
    ),
    h3("Fase 2 — Problemas ocultos por razonamiento de segundo y tercer orden"),
    lead(
      "Aquí es donde la investigación produce lo que una lluvia de ideas no produciría. Cada cadena parte de un problema obvio y pregunta repetidamente qué decisión se vuelve difícil, qué información haría falta, cómo se obtiene hoy y qué pasa si esa infraestructura también falla.",
    ),
    ...[
      [
        "Cadena A — La sequía causa dengue, y el causante es un documento administrativo",
        "Evidencia fuerte",
        "Se corta el agua, por estiaje o por daño a la infraestructura. La empresa municipal publica el calendario de racionamiento y en algunos casos declara que los tanqueros no abastecerán viviendas, por lo que es crucial que los ciudadanos se abastezcan previamente. Miles de hogares llenan recipientes, muchos destapados. Tres a cinco meses después aparece el brote de dengue, según Lowe y colegas en Brasil y Barbados. En Huaquillas, la interrupción del suministro fue el único factor de riesgo significativo a nivel de hogar. Nadie conecta el calendario de la empresa de agua con la programación de brigadas del Ministerio de Salud. La consecuencia es que existe un predictor de criaderos público, georreferenciado y con meses de anticipación, que el sector salud no consume.",
      ],
      [
        "Cadena B — Un mantenimiento eléctrico genera riesgo epidemiológico",
        "Evidencia moderada",
        "CELEC programa trabajos en la subestación Pascuales. Sin energía, la planta potabilizadora La Toma detiene la producción. Interagua suspende el servicio de doce a catorce horas en Guayaquil y cantones vecinos. Los hogares almacenan. El riesgo vectorial que se genera es consecuencia de una decisión tomada en el sector eléctrico, contabilizada por nadie. Tres agencias con tres calendarios que no se cruzan producen un daño que ninguna reporta como propio. Es el ejemplo más limpio de un problema que solo existe como consecuencia de otro problema.",
      ],
      [
        "Cadena C — El indicador que se reporta no es el que importa",
        "Evidencia fuerte",
        "Una inundación destruye una carretera. La decisión difícil no es repararla sino elegir cuál reparar primero, y para eso hace falta saber cuántas personas perdieron acceso a qué servicio. Hoy esa información no se produce: los reportes se organizan por kilómetros de vía afectada. Tariverdi y colegas midieron que en Lima las inundaciones de 2020 elevaron el acceso promedio a salud de 33 a 48 minutos, y que en Manila el 22% de la población perdió todo acceso a servicios de salud superiores con quince centímetros de agua. Mróz y colegas mostraron en Zambia que la proporción de mujeres con acceso caminando a su sitio de parto cayó del 55% al 29%. Doscientos metros de camino de tierra pueden importar más que diez kilómetros de asfalto, y el sistema actual no puede verlo.",
      ],
      [
        "Cadena D — La respuesta está sesgada hacia quien puede hablar",
        "Evidencia moderada",
        "La comunidad queda incomunicada. Por definición, no reporta. El consolidado del centro de operaciones se construye con los reportes que llegan, así que la comunidad no aparece. Los recursos se asignan según ese consolidado. El resultado es que la intensidad de la respuesta es inversamente proporcional a la gravedad del aislamiento. La ausencia de señal debería ser la alarma más fuerte del sistema y hoy se procesa como falta de datos.",
      ],
      [
        "Cadena E — La respuesta visible produce desprotección",
        "Evidencia moderada",
        "Pasa el carro fumigador. La comunidad observa que el Estado actuó. Pero con 91,5% de resistencia a deltametrina el efecto real es marginal, y los propios investigadores del INSPI concluyen que no se resuelve fumigando. La consecuencia de segundo orden es peor que la ineficacia: una señal de protección que reduce el incentivo a eliminar criaderos, que es la única intervención que la evidencia respalda. La respuesta más visible del Estado puede estar produciendo el comportamiento equivocado.",
      ],
      [
        "Cadena F — Una base de datos que parece cobertura y es ruido",
        "Evidencia fuerte",
        "Se lanza una app de reporte ciudadano. Los primeros días llegan muchos reportes. A los cincuenta días la tasa es prácticamente cero, como midieron en Mosquito Alert con dieciocho mil participantes. Pero la base de datos sigue existiendo, y ahora contiene una muestra sesgada hacia barrios con conectividad y hacia el primer mes. Las autoridades deciden sobre esa muestra creyendo que es cobertura. La solución no solo falló: dejó al sistema peor de lo que estaba, porque introdujo confianza en datos fantasma.",
      ],
      [
        "Cadena G — El modelo se calibra peor justamente donde más importa",
        "Evidencia fuerte",
        "INAMHI pasó de 230 estaciones a 90, y entre las vandalizadas están las de Esmeraldas y parte de Guayas. GEOGLOWS corrige sus simulaciones con datos observados de estaciones. Menos estaciones en la costa significa peor corrección en la costa, que es precisamente la región donde El Niño se expresa con más fuerza. La Contraloría añade que muchas estaciones son limnimétricas en sitios de difícil acceso, que en varios lugares no hay observadores y la medición está suspendida, y que hay estaciones azolvadas. El corolario para cualquier propuesta con hardware es directo: si no se responde quién lo mantiene, será una estación azolvada más.",
      ],
    ].map(([t, tag, body]) => card(t, tag, p(body))),
  ].join("\n"),
);

/* --- 4. Tracks ------------------------------------------------------ */
add(
  "tracks",
  "Tracks · Impacto comparado",
  [
    h3("¿Cuál de los cuatro tracks es el más afectado?"),
    lead(
      "La respuesta depende por completo de la unidad de medida, y las tres respuestas posibles apuntan a tracks distintos. Esta es la razón por la que conviene decidir explícitamente qué se está optimizando antes de elegir un track.",
    ),
    h4("Daño económico por track, El Niño 1997-98 en Ecuador"),
    barChart(
      TRACK_DAMAGE.map((t) => ({
        label: t.track,
        value: t.monto,
        tone:
          t.share > 40 ? "danger" : t.share > 20 ? "warning" : t.share > 10 ? "info" : "neutral",
      })),
      { fmt: (v) => "US$ " + v.toLocaleString("es-EC") + " M" },
    ),
    note(
      "Daños totales en millones de dólares corrientes (directos más indirectos). Fuente: informe CEPAL sobre El Niño 1997-1998 en Ecuador, total nacional US$ 2.869,3 M. La asignación de sectores CEPAL a tracks del hackatón es propia.",
    ),
    h4("Participación de cada track en el daño total"),
    donut([
      { label: "Agrotecnología", value: 1243.7, tone: "danger" },
      { label: "Telecom y vialidad", value: 786.8, tone: "warning" },
      { label: "No asignable", value: 488.7, tone: "neutral" },
      { label: "Gestión de riesgos", value: 331.1, tone: "info" },
      { label: "Salud pública", value: 19.0, tone: "success" },
    ]),
    callout(
      "warning",
      "Salud pública concentra 0,7% del daño económico y ahí está justamente la oportunidad",
      "Los 19 millones de dólares del sector salud frente a los 1.244 millones del agropecuario no significan que el problema sanitario sea menor. Significan que es el track con menor huella contable y, por lo tanto, el menos instrumentado y el que menos atención institucional recibe. El sector agropecuario ya tiene plan de acción con escenarios cuantificados del MAG y la SGR, seguro agrícola subvencionado por el Estado y modelos de pérdida esperada del Banco Central. Salud no tiene nada equivalente para el riesgo vectorial.",
    ),
    h4("Las tres respuestas, según lo que se mida"),
    table(
      ["Criterio", "Track más afectado", "Evidencia"],
      [
        [
          "Pérdida económica",
          "3 · Agrotecnología, con amplio margen",
          "En 1997-98 el sector agropecuario y pesca perdió US$ 1.243,7 M, es decir 43,3% del daño nacional total. El plan de acción de la SGR para 2023-24 proyectó 945.504 hectáreas afectadas, equivalentes al 44% de la superficie agrícola nacional, y US$ 1.800 M de pérdidas agrícolas, con el arroz entre US$ 257 y 427 M y el banano en US$ 600 M de exportaciones. El Banco Central estimó pérdidas esperadas de US$ 2.332 M para un Niño moderado y US$ 2.705 M para uno severo.",
        ],
        [
          "Vidas perdidas durante el evento",
          "1 y 4 · Telecomunicaciones y gestión de riesgos",
          "Los fallecidos de 1997-98 (entre 244 y 286 según la fuente, más 147 a 162 heridos y 36 a 52 desaparecidos) se produjeron por inundaciones y deslizamientos, no por enfermedad. El daño humano agudo pertenece al eje de alerta, evacuación y aislamiento, no al sanitario.",
        ],
        [
          "Daño que ya está ocurriendo hoy, antes del pico",
          "2 · Salud pública",
          "Es el único track con daño observado y en aceleración en este momento: 28.652 casos de dengue y 35 fallecidos hasta mediados de agosto de 2026, con once semanas consecutivas por encima de 2025, y todo esto antes de que empiece la temporada lluviosa. En los otros tres tracks el daño de 2026-27 es todavía pronóstico.",
        ],
        [
          "Desprotección del afectado",
          "3 · Agrotecnología",
          "Hasta abril de 2023 había 15.247 hectáreas con pérdida total, pero solo 8.735 hectáreas aseguradas de los 5,2 millones de hectáreas de superficie agropecuaria del país, cerca del 0,17%. Y según el IICA los productores contratan el seguro solo cuando la entidad financiera lo exige para dar crédito.",
        ],
      ],
      { rowTone: ["danger", "warning", "info", "neutral"] },
    ),
    h4("Discrepancia entre fuentes que conviene no ocultar"),
    p(
      "El costo de El Niño 1997-98 como porcentaje del PIB ecuatoriano varía de forma incómoda según la fuente: la FAO lo sitúa alrededor del 15% del PIB nominal, el plan de acción de la SGR en 17%, y el Banco Central del Ecuador en cerca de 2,7%. La diferencia se explica porque no todos miden lo mismo: unos suman daños directos e indirectos contra el PIB de un año, otros estiman el impacto sobre el crecimiento, que la FAO cifra en 1,2% del PIB. Si se cita esta magnitud en un pitch, conviene decir cuál de las dos cosas se está midiendo.",
    ),
    quote(
      "El track más afectado y el mejor track para competir no son el mismo. Agrotecnología concentra el daño, y por eso mismo concentra también los actores, los planes y el presupuesto ya existentes. Salud pública concentra menos del uno por ciento del daño contable y por eso conserva un vacío de instrumentación que una propuesta pequeña sí puede llenar en un fin de semana.",
    ),
  ].join("\n"),
);

/* --- 5. Estado del arte --------------------------------------------- */
add(
  "arte",
  "Fase 3 · Estado del arte",
  [
    lead(
      "La pregunta útil no es qué se puede construir sino qué problema importante sigue sin resolverse. Este mapeo se hizo antes de generar soluciones, y su efecto principal fue descartar propuestas que parecían buenas.",
    ),
    table(
      ["Dominio", "Qué existe hoy", "Qué funciona", "Qué no funciona", "El vacío aprovechable"],
      [
        [
          "Pronóstico hidrológico",
          "INAMHI-GEOGLOWS (SERVIR-Amazonia/NASA): 2.300 tramos de río, pronóstico a 15 días, validación en 235 estaciones, app de manchas de inundación. GloFAS a escala global.",
          "Funciona de verdad: unos 40 casos validados de alerta de inundación en 38 cuencas durante 2024-2025, adoptado por INAMHI y usado por SNGR.",
          "Entrega caudal, no impacto. Es una plataforma web que requiere internet y criterio técnico. Se corrige con estaciones que en la costa ya no existen.",
          "La traducción de caudal a impacto local y su entrega a la última milla. Construir otro pronosticador sería redundante.",
        ],
        [
          "Comunicación offline",
          "Meshtastic: código abierto, nodos por debajo de US$20, 4 km urbanos y hasta 15 rurales, solar. Más de 300 nodos en Argentina, cobertura completa de Bahía Blanca y Bariloche, gateways de alertas y puente a WhatsApp.",
          "Funciona y ya está desplegado por comunidades en Chile y Argentina, sin financiamiento estatal.",
          "No resuelve quién mantiene los nodos, quién escucha del otro lado ni qué se hace con el mensaje recibido.",
          "La capa de decisión sobre la malla. La radio ya está resuelta y es gratis.",
        ],
        [
          "Predicción de dengue",
          "Modelos climáticos de alta calidad: Mills & Donnelly en Piura, Tumbes y Lambayeque; Lowe en Barbados y Brasil. Todos con variables meteorológicas.",
          "Muy bien: clasificación correcta del 100% de brotes futuros con umbral de 50 por 100.000 y probabilidad de falsa alarma de 0,12 en el caso peruano.",
          "Predicen el cantón y el mes, no la manzana ni la semana. Y omiten la variable que la evidencia ecuatoriana señala como causal proximal: la interrupción del servicio de agua.",
          "Bajar la resolución a manzana usando el dato operativo de la empresa de agua, y convertir la predicción en cola de trabajo.",
        ],
        [
          "Reporte ciudadano",
          "Mosquito Alert (18.000 participantes en Italia, 23 países europeos) y DengueChat en Latinoamérica.",
          "DengueChat sí redujo índices entomológicos por debajo del umbral de transmisión, frente a barrios control en nivel de alarma.",
          "Mosquito Alert: solo 30% reporta alguna vez, la mitad una única vez, y la tasa cae a casi cero a los 50 días. Los autores de DengueChat insisten en que el resultado vino del trabajo presencial, no del software.",
          "Ninguno para el reporte voluntario. El vacío está en herramientas para quien ya está pagado para recorrer el territorio.",
        ],
        [
          "Detección de apagones y daños",
          "NASA Black Marble VNP46A2: 500 m, diario, desde 2012, corregido por luna y atmósfera. Flujos validados en Sandy, María y la tormenta Uri.",
          "Detecta apagones de forma sistemática y gratuita, sin desplegar nada. En Uri identificó además inequidad en la distribución de cortes.",
          "Se bloquea con nubosidad, que es la condición dominante en una emergencia por lluvias. 500 m no distingue caseríos.",
          "Uso complementario para corroborar aislamiento, nunca como detector único en temporada lluviosa.",
        ],
        [
          "Acción anticipatoria",
          "Marcos activos o en desarrollo para El Niño en Colombia, Ecuador, Perú, Bolivia y Venezuela. Financiamiento basado en pronósticos de OCHA y la Cruz Roja.",
          "Los pilotos de OCHA alcanzaron cerca de 2,2 millones de personas en Somalia, Etiopía y Bangladesh.",
          "Los disparadores requieren destreza que muchos pronósticos no tienen, y los montos comprometidos no alcanzan la escala de un evento moderado a fuerte.",
          "Hay dinero institucional buscando disparadores locales verificables. Es un comprador identificado con calendario favorable.",
        ],
        [
          "Accesibilidad e infraestructura crítica",
          "Método publicado por Tariverdi y colegas con casos de Lima y Manila, sobre datos abiertos. Mróz y colegas para acceso materno en Zambia.",
          "El método es sólido, replicable y usa exclusivamente datos abiertos.",
          "No está operacionalizado en Ecuador: es un artículo, no una herramienta de sala de situación.",
          "La implementación operativa. El aporte sería de adopción, no de invención, y hay que decirlo.",
        ],
      ],
    ),
    callout(
      "danger",
      "Consecuencia directa: tres ideas quedan eliminadas antes de nacer",
      "Construir una malla LoRa de emergencia duplica Meshtastic. Construir una app de reporte ciudadano de criaderos está empíricamente refutada. Construir otro predictor de inundaciones compite contra un sistema nacional que ya funciona. Estas tres son, con alta probabilidad, las propuestas más frecuentes del hackatón.",
    ),
  ].join("\n"),
);

/* --- 6. Priorización ------------------------------------------------ */
add(
  "prioridad",
  "Fase 4 · Priorización",
  [
    lead(
      "Trece criterios, puntuados de 1 a 10, sobre problemas y no sobre soluciones. Las puntuaciones son juicio analítico propio, no una medición, y se muestran desagregadas para que puedan discutirse.",
    ),
    barChart(
      RANKED.map((r) => ({
        label: `${r.id} · ${r.nombre}`,
        value: norm(r.s),
        tone: norm(r.s) >= 83 ? "success" : norm(r.s) >= 76 ? "info" : "neutral",
      })),
      { max: 100, fmt: (v) => v + "/100" },
    ),
    note(
      "Puntuación total normalizada sobre 100, a partir de trece criterios de 1 a 10 (máximo bruto 130). Corte para el top 5: 78. Fuente: valoración propia de este análisis, no una medición empírica.",
    ),
    table(
      ["#", "Problema", ...CRITERIA, "Bruto", "/100"],
      RANKED.map((r) => [
        r.id,
        r.nombre,
        ...r.s.map(String),
        String(totalOf(r.s)),
        String(norm(r.s)),
      ]),
      {
        rowTone: RANKED.map((r) =>
          norm(r.s) >= 83 ? "success" : norm(r.s) >= 76 ? "info" : "neutral",
        ),
        align: ["left", "left", ...CRITERIA.map(() => "center"), "right", "right"],
      },
    ),
    card(
      "Definición de los trece criterios",
      "",
      table(["Abreviatura", "Criterio"], CRITERIA_FULL.map(([a, b]) => [a, b])),
    ),
    h4("Lo que revela la matriz"),
    p(
      "El problema de la última milla de la alerta obtiene la severidad y la urgencia más altas de toda la tabla, y sin embargo cae al octavo lugar. La razón es que puntúa 4 en falta de soluciones y 3 en diferenciación: es un problema real y grave que muchísima gente ya está atacando. Ese es exactamente el tipo de trampa que una lluvia de ideas convencional no detecta, porque la intuición sobre gravedad no distingue entre un problema sin resolver y un problema muy atendido.",
    ),
    p(
      "En el otro extremo, la cascada energía-agua-salud obtiene 10 en falta de soluciones, 10 en innovación y 10 en diferenciación, y aun así termina sexta, penalizada por viabilidad de MVP y por facilidad de demostración. El primer lugar lo toma el problema que combina evidencia máxima con viabilidad máxima, que es la combinación que un hackatón premia.",
    ),
  ].join("\n"),
);

/* --- 7. Soluciones y red team --------------------------------------- */
add(
  "soluciones",
  "Fases 5-7 · Soluciones y red team",
  [
    lead(
      `${SOLUTIONS.length} propuestas, cada una evaluada en las dieciséis dimensiones exigidas y luego atacada sin cortesía. Se incluyen a propósito dos propuestas malas, porque descartarlas con evidencia es parte del argumento: demuestra que el camino elegido se eligió y no se ocurrió.`,
    ),
    ...SOLUTIONS.map((s) =>
      card(
        `${s.nombre} — ${s.veredicto === "top" ? "sobrevive" : s.veredicto === "viable" ? "viable con reservas" : "descartada"}`,
        s.veredicto === "top" ? "__open" : `${s.score} / 100`,
        [
          h4("Insight"),
          p(s.insight),
          table(
            ["Dimensión", "Respuesta"],
            [
              ["Problema", s.problema],
              ["Usuario", s.usuario],
              ["Cómo funciona", s.como],
              ["Tecnología", s.tech],
              ["Datos y su procedencia", s.datos],
              ["Sin internet", s.conectividad],
              ["Sin electricidad", s.energia],
              ["MVP del hackatón", s.mvp],
              ["Demo de 3 minutos", s.demo],
              ["Costos", s.costo],
              ["Quién lo opera", s.operacion],
              ["Quién paga", s.cliente],
              ["Riesgo principal", s.riesgo],
              ["Puntuación", `${s.score} / 100`],
            ],
          ),
          h4("Red team"),
          `<ul class="rt">${s.redteam.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`,
        ].join("\n"),
      ),
    ),
  ].join("\n"),
);

/* --- 8. Top 5 -------------------------------------------------------- */
const TOP5 = SOLUTIONS.filter((s) => s.veredicto !== "descartada").slice(0, 5);
add(
  "top5",
  "Fase 8 · Top 5",
  [
    lead(
      "Ordenadas por puntuación total. La columna final responde a la pregunta que importa en un hackatón, que no es si la idea es buena sino por qué ganaría.",
    ),
    barChart(
      TOP5.map((t, i) => ({
        label: t.nombre,
        value: t.score,
        tone: i === 0 ? "success" : i < 3 ? "info" : "neutral",
      })),
      { max: 100, fmt: (v) => v + "/100" },
    ),
    table(
      ["Propuesta", "Problema", "Diferenciador", "Evidencia clave", "MVP", "Por qué podría ganar", "/100"],
      [
        [
          "VENTANA SECA",
          "Las brigadas de control vectorial se despliegan tarde y en la manzana equivocada, cuando la fumigación ya no funciona.",
          "Es el único enfoque que usa el dato operativo de la empresa de agua como predictor de criaderos, en lugar de variables meteorológicas.",
          "Lowe 2021 (rezago de 3 a 5 meses tras sequía), Huaquillas 2021 (interrupción de agua como único factor significativo), INSPI (91,5% de resistencia).",
          "Motor de riesgo validado retrospectivamente contra un brote real, más app de brigada funcionando sin conexión.",
          "Tiene la mejor evidencia, un insight que nadie más va a traer, cero hardware, un usuario que no tiene que cambiar de hábito y una demo que reproduce un brote real usando un documento público.",
          "90",
        ],
        [
          "QUIÉN QUEDA SOLO",
          "Se prioriza por activo vial dañado en lugar de por población que perdió acceso a un servicio.",
          "Cambia la unidad de medida de kilómetros de vía a personas-minuto de acceso perdido.",
          "Tariverdi 2023 (Lima 33 a 48 minutos, Manila 22% sin acceso), Mróz 2023 (55% a 29% de acceso materno).",
          "Cálculo real para un cantón afectado, con lista priorizada de segmentos.",
          "Es la demo más comprensible de todas y usa exclusivamente datos abiertos, pero el aporte es de implementación y no de invención.",
          "83",
        ],
        [
          "PUNTO CIEGO",
          "La respuesta se asigna por reportes recibidos, y quien más necesita ayuda es quien no puede reportar.",
          "Trata la ausencia de señal como la señal principal, en lugar de como falta de datos.",
          "NASA Black Marble validado en Sandy, María y Uri; evidencia de inequidad en la distribución de cortes.",
          "Detección retrospectiva de apagones con VIIRS más dos nodos con latido en vivo.",
          "El insight más elegante del conjunto y la demo más teatral, pero la nubosidad de la temporada lluviosa ataca su fundamento físico.",
          "79",
        ],
        [
          "TRADUCTOR DE CAUDAL",
          "GEOGLOWS pronostica caudal a quince días y nadie sabe qué significa para su calle.",
          "No construye un pronóstico: construye el traductor del que ya existe, calibrado con marcas de agua de la comunidad.",
          "INAMHI-GEOGLOWS con 40 casos validados en 38 cuencas; Trogrlić 2022 sobre vacíos en los componentes sociales de las alertas.",
          "Curva calibrada para una comunidad con alerta de tres niveles por SMS.",
          "Es honesto y necesario, pero compite en la categoría más saturada del hackatón y su costo de calibración por comunidad no escala.",
          "76",
        ],
        [
          "ACTA VERDE",
          "El pequeño productor no puede probar el daño, así que la compensación no llega.",
          "Produce evidencia admisible para una institución financiera, no un diagnóstico agronómico.",
          "Nauman 2021 sobre observación terrestre para acción temprana; brecha documentada en evaluación de vulnerabilidad e impacto.",
          "Captura offline con expediente y corroboración satelital de un evento real.",
          "Tiene el cliente más claro y el riesgo más claro: si el banco o la aseguradora no cambian su procedimiento, el expediente no sirve.",
          "72",
        ],
      ],
      { rowTone: ["success", "info", "info", "neutral", "neutral"], align: [,,,,,, "right"] },
    ),
  ].join("\n"),
);

/* --- 9. Duelo -------------------------------------------------------- */
const CRIT = [
  ["Impacto potencial", 9, 9],
  ["Innovación", 9, 7],
  ["Evidencia", 10, 9],
  ["Factibilidad técnica", 9, 7],
  ["Claridad del problema", 9, 9],
  ["Calidad de la demo", 9, 6],
  ["Escalabilidad", 9, 8],
  ["Sostenibilidad", 9, 8],
  ["Diferenciación real", 9, 5],
  ["Viabilidad del MVP", 9, 6],
  ["Magnitud del track", 5, 10],
  ["Cercanía del comprador", 8, 5],
];
const sumA = CRIT.reduce((a, c) => a + c[1], 0);
const sumB = CRIT.reduce((a, c) => a + c[2], 0);

add(
  "duelo",
  "Duelo · Finalista A vs B",
  [
    lead(
      "Las dos finalistas evaluadas con los mismos doce criterios de jurado, de 1 a 10. La comparación no es simétrica en un punto importante y conviene decirlo: AVAL VERDE ataca el track con más daño, y VENTANA SECA ataca el track con menos competencia.",
    ),
    stats([
      { value: String(Math.round((sumA / 120) * 100)), label: "VENTANA SECA · salud pública · sobre 100", tone: "success" },
      { value: String(Math.round((sumB / 120) * 100)), label: "AVAL VERDE · agrotecnología · sobre 100", tone: "info" },
      { value: "43,3%", label: "Participación del track agro en el daño de El Niño", tone: "warning" },
      { value: "0,7%", label: "Participación del track salud en el daño de El Niño", tone: "warning" },
    ]),
    groupedBars(CRIT, "VENTANA SECA", "AVAL VERDE", 10),
    note("Puntuación de 1 a 10 por criterio. Fuente: valoración propia de este análisis, no una medición empírica."),
    table(
      ["Dimensión", "VENTANA SECA", "AVAL VERDE"],
      [
        ["Track", "2 · Salud pública", "3 · Agrotecnología"],
        ["Daño del track en El Niño 1997-98", "US$ 19 M, el 0,7% del total", "US$ 1.243,7 M, el 43,3% del total"],
        [
          "Insight",
          "El calendario de suspensiones de la empresa de agua es una predicción de criaderos con tres a cinco meses de anticipación, y salud no lo lee.",
          "El cliente del seguro agrícola nunca fue el productor sino el banco, y el prestamista puede reestructurar antes de la inundación.",
        ],
        [
          "¿Ya existe algo igual?",
          "No. Los predictores de dengue publicados usan variables meteorológicas; ninguno usa el dato operativo de la empresa de agua.",
          "Parcialmente sí. La verificación fotográfica está publicada y evaluada por el IFPRI, y hay cuatro insurtech financiadas en la región.",
        ],
        [
          "Quién paga",
          "MSP por vía distrital, con ruta alternativa por municipio y empresa de agua. Ciclo corto.",
          "Prestamista, aseguradora o MAG. Ciclo de venta de meses, aversión a pilotos.",
        ],
        ["Hardware requerido", "Ninguno. Solo un teléfono que ya se carga.", "Ninguno. Solo un teléfono, más acceso a datos satelitales."],
        [
          "Qué se construye en el hackatón",
          "Motor de riesgo validado retrospectivamente, app de brigada offline y panel distrital. Insumo principal ya publicado en la web.",
          "Captura offline con expediente, corroboración con radar sobre un evento real y panel de exposición sobre agregados del Banco Central.",
        ],
        [
          "Fortaleza de la demo",
          "Alta. Reproduce un brote real con un documento público y termina con el teléfono en modo avión.",
          "Media. La parte más innovadora es financiera y por tanto más abstracta para un jurado.",
        ],
        [
          "Debilidad principal",
          "La curva de rezago de tres a cinco meses viene de Brasil y Barbados y podría no replicarse con datos ecuatorianos.",
          "Cuatro competidores financiados y un comprador con ciclo de decisión largo.",
        ],
        ["Riesgo de que el jurado diga que ya existe", "Bajo", "Alto"],
        ["Riesgo de que el jurado diga que el problema es menor", "Medio, por el 0,7% del daño económico", "Muy bajo, por el 43,3%"],
      ],
      {
        rowTone: ["neutral", "warning", "neutral", "danger", "neutral", "neutral", "neutral", "neutral", "danger", "neutral", "neutral"],
      },
    ),
    h4("La recomendación, y en qué caso cambiaría"),
    quote(
      "VENTANA SECA sigue ganando, y la razón es que un hackatón no premia atacar el problema más grande sino demostrar en tres minutos que encontraste algo que los demás no vieron y que puedes construirlo. AVAL VERDE tiene la magnitud, pero su insight ya está publicado, su espacio tiene cuatro empresas con capital y su comprador es un banco. VENTANA SECA tiene un insight que exige haber cruzado tres literaturas que no se citan entre sí, y una demo que reproduce un brote real usando un documento que el propio Estado publica.",
    ),
    p(
      "Cambiaría la recomendación en dos escenarios concretos. El primero, si las bases del hackatón puntúan explícitamente la magnitud del impacto económico atendido, porque ahí el 43,3% contra el 0,7% es un argumento difícil de rebatir. El segundo, si en el equipo hay alguien con acceso real a la cartera de un prestamista o de una cooperativa con crédito agrícola en la costa, porque eso convierte la debilidad principal de AVAL VERDE en su mayor fortaleza y ninguna insurtech brasileña puede replicar ese acceso en Ecuador.",
    ),
    callout(
      "info",
      "Nota sobre la puntuación de la propuesta agro",
      "La brecha de aseguramiento del 0,17% subió su evidencia de 6 a 9, pero el descubrimiento de cuatro competidores financiados y de la evaluación ya publicada del IFPRI bajó la falta de soluciones de 7 a 5 y la diferenciación de 7 a 5. Los dos efectos casi se cancelan y la propuesta queda alrededor de 74. VENTANA SECA se mantiene en 90.",
    ),
  ].join("\n"),
);

/* --- 10. Finalista A: VENTANA SECA ----------------------------------- */
add(
  "ventana-seca",
  "Finalista A · VENTANA SECA",
  [
    `<p class="kicker">FASE 9 · VEREDICTO · TRACK 2 · SALUD PÚBLICA</p>`,
    `<h3 class="big">VENTANA SECA</h3>`,
    lead(
      "Focalización de brigadas de control vectorial a partir del calendario de suspensiones de la empresa de agua potable.",
    ),
    callout(
      "success",
      "Por qué esta y no otra",
      "Evaluada contra impacto, innovación, evidencia, factibilidad, claridad, demo, escalabilidad y sostenibilidad, es la única propuesta que puntúa alto en todas a la vez. Las demás sacrifican algo: PUNTO CIEGO tiene mejor insight pero su física falla bajo nubes; QUIÉN QUEDA SOLO tiene mejor demo pero su método ya está publicado; TRADUCTOR DE CAUDAL es necesario pero compite contra veinte equipos iguales.",
    ),
    h4("1. El problema en una frase"),
    p(
      "Las brigadas de control vectorial de Ecuador, que son el único recurso que aún funciona contra el dengue porque la fumigación enfrenta 91,5% de resistencia, se despliegan con meses de retraso y en la manzana equivocada, porque se guían por casos ya notificados y por la temporada de lluvias, cuando la evidencia demuestra que el riesgo se construye tres a cinco meses antes, en los barrios donde se cortó el agua.",
    ),
    h4("2. La evidencia de que el problema es real"),
    table(
      ["Hallazgo", "Fuente", "Fuerza"],
      [
        ["El riesgo de dengue urbano es alto de 3 a 5 meses después de una sequía extrema, por recipientes improvisados; los autores dicen explícitamente que las intervenciones deberían programarse ahí y no solo en la temporada lluviosa.", "Lowe et al., Lancet Planetary Health (2021), Brasil; confirma Barbados (PLOS Medicine 2018)", "Fuerte"],
        ["En Huaquillas (Ecuador), la interrupción del suministro de agua fue el ÚNICO factor de riesgo estadísticamente significativo para presencia de Ae. aegypti a nivel de hogar. Igual vínculo documentado en Machala.", "PLOS Neglected Tropical Diseases (2021)", "Fuerte"],
        ["En Machala, los mejores predictores de pupas fueron almacenamiento de agua, acceso a agua entubada y condición de casa y patio; el efecto de la lluvia varió según el tipo de recipiente.", "Stewart-Ibarra et al., PLOS ONE (2013)", "Fuerte"],
        ["Existe una banda crítica de densidad de 3.000 a 7.000 hab/km²; las zonas con suministro adecuado no tuvieron brotes severos y el riesgo rural superó al urbano por falta de agua entubada.", "PLOS Medicine, cohorte de 75.000 hogares, Vietnam", "Fuerte"],
        ["91,5% de resistencia a deltametrina y 62% a temefos; los investigadores concluyen que no se resuelve fumigando y hay que combinar con reducción de criaderos.", "Gaceta INSPI, Ecuador, hasta junio 2025", "Fuerte"],
        ["28.652 casos y 35 muertes hasta mediados de agosto de 2026, con 11 semanas consecutivas sobre 2025, antes de la temporada lluviosa de El Niño.", "MSP Ecuador; OPS SE29", "Fuerte"],
        ["EPMAPS publica Mapa de Suspensiones y Calendario de racionamientos por barrio; en nov-2024 hubo cortes de hasta 10 horas en 95 barrios. Interagua declaró que los tanqueros no abastecerían viviendas y que era crucial el abastecimiento previo.", "Portales y comunicados de EPMAPS e Interagua", "Fuerte (documental)"],
        ["La reducción de criaderos con brigadas y organización comunitaria llevó los índices entomológicos por debajo del umbral de transmisión, frente a controles en nivel de alarma.", "Holston et al., AJTMH (2021), DengueChat; piloto pequeño, no aleatorizado", "Moderada"],
        ["El reporte ciudadano voluntario cae a casi cero a los 50 días: solo 30% de 18.000 participantes reportó alguna vez y la mitad una sola vez.", "Mosquito Alert Italia, Science of the Total Environment (2024)", "Fuerte (negativa)"],
        ["El Niño incrementa la frecuencia de interrupciones del servicio de agua por turbiedad, daño a captaciones y fallas eléctricas.", "Inferencia propia a partir del caso Interagua-CELEC; NO verificada con datos operativos", "Hipótesis"],
        ["La curva de rezago de 3 a 5 meses medida en Brasil y Barbados se replica con datos ecuatorianos.", "Pendiente de validación; es el primer entregable del piloto", "Hipótesis"],
      ],
      {
        rowTone: ["success", "success", "success", "success", "success", "success", "success", "info", "success", "warning", "warning"],
      },
    ),
    note(
      "Las dos últimas filas están marcadas como hipótesis a propósito. Son inferencias nuestras, no hallazgos publicados, y presentarlas como hechos sería el error más fácil de detectar por un jurado técnico.",
    ),
    h4("3. El insight"),
    quote(
      "El mejor predictor de dónde habrá dengue no está en los datos meteorológicos. Está en el calendario de suspensiones de la empresa de agua potable. El Estado publica, con días de anticipación y con resolución de barrio, el mapa exacto de dónde miles de hogares van a llenar recipientes destapados. En Guayaquil incluso lo ordena: los tanqueros no abastecen viviendas, así que abastézcase previamente. Ese documento administrativo es una predicción de criaderos con tres a cinco meses de anticipación, y el sector salud no lo lee.",
    ),
    p(
      "El corolario es más fuerte que el insight: el sector que genera el riesgo vectorial no es el sanitario ni el climático, es el de infraestructura. Y cuando la causa raíz de una suspensión es un mantenimiento eléctrico en una subestación, como en el caso La Toma, resulta que el sector eléctrico está produciendo dengue sin que nadie lo contabilice.",
    ),
    h4("4. La solución en una frase"),
    p(
      "Un motor que convierte los calendarios de racionamiento y las órdenes de trabajo de las empresas de agua en una cola priorizada de manzanas para las brigadas de control vectorial, entregada en una aplicación que funciona sin conexión, y que se recalibra con lo que las brigadas encuentran en cada predio.",
    ),
    h4("5. Cómo funciona, paso a paso"),
    table(
      ["Paso", "Qué ocurre"],
      [
        ["1", "El sistema ingiere diariamente el mapa y el calendario de suspensiones publicados por la empresa de agua, junto con órdenes de trabajo y despachos de tanqueros cuando hay convenio."],
        ["2", "Cada barrio afectado se convierte en polígono y se cruza con la grilla de población para aislar la banda crítica de 3.000 a 7.000 habitantes por kilómetro cuadrado."],
        ["3", "Se añaden temperatura de superficie y precipitación satelital, y un modelo de rezagos distribuidos calcula por manzana la probabilidad de acumulación de recipientes, con dos mecanismos: exceso de lluvia con rezago de cero a tres meses e interrupción de servicio con rezago de tres a cinco meses."],
        ["4", "El riesgo no se publica como mapa de calor. Se convierte en una cola de trabajo ordenada, dimensionada al número real de brigadas y a la duración de la jornada, con ruta sugerida."],
        ["5", "El brigadista descarga la cola en el centro de salud y trabaja el día entero sin conexión, registrando por predio el número y tipo de recipientes y su positividad."],
        ["6", "Al volver, la app sincroniza. Los hallazgos alimentan el índice entomológico oficial y recalibran el modelo, que aprende qué tipo de sector responde a qué mecanismo."],
        ["7", "La dirección distrital ve en un panel la cobertura de manzanas de alto riesgo visitadas antes del pico previsto, y exporta un respaldo imprimible."],
      ],
      { align: ["center", "left"] },
    ),
    h4("6. Arquitectura tecnológica"),
    table(["Capa", "Función", "Implementación"], ARCH_ROWS),
    h4("7. Fuentes de datos"),
    table(
      ["Dato", "Origen", "Acceso"],
      [
        ["Mapa y calendario de suspensiones", "EPMAPS, Interagua y pares municipales", "Público, sin API: requiere raspado"],
        ["Órdenes de trabajo y tanqueros", "Empresas de agua", "Requiere convenio; mejora mucho el modelo"],
        ["Casos de dengue por parroquia", "MSP, vigilancia epidemiológica", "Público agregado; el detalle requiere convenio"],
        ["Índices entomológicos históricos", "MSP", "Requiere convenio; es la variable de calibración"],
        ["Grilla de población", "INEC, WorldPop, HRSL", "Abierto"],
        ["Temperatura de superficie y precipitación", "MODIS, VIIRS, CHIRPS, GPM", "Abierto"],
        ["Calendario de mantenimiento eléctrico", "CELEC y distribuidoras", "Parcialmente público; habilita la cascada"],
      ],
    ),
    h4("8. Qué se construye realmente durante el hackatón"),
    p(
      "Tres piezas, ninguna de ellas hardware. Primero, el motor de riesgo entrenado con el histórico real de suspensiones de un cantón y la curva de casos del MSP, con validación retrospectiva. Segundo, la aplicación de brigada como web progresiva, con la cola descargable, la captura de hallazgos por predio y la sincronización oportunista, demostrable en modo avión. Tercero, el panel distrital con la cobertura de manzanas de alto riesgo y la exportación imprimible. Es alcanzable porque no hay que desplegar nada en territorio ni conseguir permisos: el insumo principal ya está publicado en la web de la empresa de agua.",
    ),
    h4("9. La demo de tres minutos"),
    table(
      ["Tiempo", "Qué se muestra en pantalla", "Qué se dice"],
      [
        ["0:00–0:30", "El calendario de racionamiento real publicado por la empresa de agua, y el comunicado que dice que los tanqueros no abastecerán viviendas y es crucial abastecerse previamente.", "Este es un documento público. Es también una predicción de criaderos con cinco meses de anticipación, y nadie en salud lo está leyendo."],
        ["0:30–1:15", "Se superpone la curva real de casos de dengue del cantón sobre las fechas de corte, mostrando el pico en la ventana predicha.", "El brote no llegó con la lluvia. Llegó con el rezago que Lowe midió en Brasil y Barbados, contado desde el corte de agua."],
        ["1:15–2:00", "El mapa de dónde estuvieron realmente las brigadas frente al mapa de la cola priorizada por el motor, con la cifra de discrepancia.", "Las brigadas hicieron su trabajo. Lo hicieron en el lugar y el momento que el sistema les indicó, y el sistema estaba mirando el reloj equivocado."],
        ["2:00–2:40", "Se pone el teléfono en modo avión, se recorre la cola, se registran recipientes en dos predios y se sincroniza al reconectar.", "El brigadista no necesita señal, no necesita aprender nada nuevo y no camina un metro más. Solo cambia el orden en que camina."],
        ["2:40–3:00", "El panel distrital con el porcentaje de manzanas de alto riesgo cubiertas antes del pico.", "No pedimos presupuesto nuevo ni hardware. Pedimos leer un documento que el propio Estado ya publica."],
      ],
      { align: ["center", "left", "left"] },
    ),
    h4("10. Métricas de éxito"),
    table(["Métrica", "Por qué es la correcta", "Cómo se mide"], METRIC_ROWS),
    note(
      "Deliberadamente no se mide descargas, usuarios registrados ni reportes recibidos. Esas son las métricas que hicieron parecer exitosas a las apps de reporte ciudadano antes de que cayeran a cero.",
    ),
    h4("11. Primer usuario"),
    p(
      "El jefe de control vectorial de un distrito de salud de Manabí, Guayas o Los Ríos, que hoy programa brigadas con una hoja de cálculo y la curva de casos de la semana pasada. Y el brigadista, que recibe la cola en el teléfono y trabaja sin señal.",
    ),
    h4("12. Primer cliente"),
    p(
      "El Ministerio de Salud Pública por la vía distrital, con ruta alternativa por el municipio y la empresa de agua, que gana un argumento de gestión social para sus propios cortes. Los fondos de acción anticipatoria activos para El Niño en Ecuador son el tercer comprador, y buscan exactamente disparadores locales verificables.",
    ),
    h4("13. Sostenibilidad"),
    p(
      "No crea una operación nueva ni un costo recurrente en territorio: se inserta en un proceso que ya existe y ya está presupuestado. Eso es lo que lo distingue de una estación azolvada o de una app abandonada. El costo de servidor es marginal y el mantenimiento crítico es el de los raspadores.",
    ),
    h4("14. Plan de implementación"),
    table(["Horizonte", "Actividad", "Criterio de avance"], PLAN_ROWS),
    h4("15. Escalabilidad"),
    p(
      "Escala por empresa de agua, no por comunidad, y esa es la diferencia decisiva frente a las alternativas. Un traductor de caudal necesita calibrar una curva por cada comunidad; aquí, incorporar una empresa de agua nueva incorpora de golpe todos sus cantones. El mecanismo causal es genérico y aplica a cualquier ciudad latinoamericana con servicio de agua intermitente, que es la norma y no la excepción en la región.",
    ),
    h4("16. Ventaja competitiva"),
    p(
      "No es el código, que es copiable en una semana. Es la relación de datos con la empresa de agua, el diccionario de topónimos de barrio a polígono construido con revisión humana, y el volante de inercia de los hallazgos de brigada: cada jornada mejora el modelo y ningún competidor tiene ese histórico. Y el insight en sí ya es una barrera, porque exige haber leído literatura de tres campos que no se citan entre sí.",
    ),
    h4("17. Los riesgos, sin maquillaje"),
    table(
      ["Riesgo", "Severidad", "Mitigación honesta"],
      [
        ["La curva de rezago de 3 a 5 meses viene de Brasil y Barbados y puede no replicarse con datos ecuatorianos.", "Alta", "Es el primer entregable del piloto, no un supuesto. Si no se replica, el producto se reduce a focalización espacial, que sigue teniendo valor por la evidencia de Huaquillas y Machala."],
        ["El dato de la empresa de agua puede ser de mala calidad, y las interrupciones no programadas quizá no queden registradas.", "Alta", "Versionado de los raspados para detectar degradación, y convenio para acceder a órdenes de trabajo, que sí registran lo no programado."],
        ["El MSP puede no adoptar el cambio en su programación de brigadas.", "Media", "Ruta alternativa por municipio y empresa de agua. El motor tiene valor independiente como disparador de acción anticipatoria."],
        ["En la costa durante El Niño el mecanismo dominante puede ser el húmedo y no el de almacenamiento, reduciendo la ventaja del insight.", "Media", "El modelo incluye ambos mecanismos por diseño. La ventaja se reduce pero no desaparece, y el mecanismo de almacenamiento sigue operando por daño a la red."],
        ["La reducción de criaderos podría no bastar para bajar la incidencia, dado el serotipo DENV-3 circulante y la inmunidad poblacional.", "Media", "Por eso la métrica principal son los índices entomológicos y no la incidencia: es lo que la intervención puede mover y lo que DengueChat efectivamente movió."],
        ["Alguien puede copiar el enfoque.", "Baja", "Que lo copien es el mejor resultado posible para el problema. La ventaja defendible es el histórico de brigada y la relación institucional."],
      ],
      { rowTone: ["danger", "danger", "warning", "warning", "info", "info"] },
    ),
    h4("18. Por qué debería ganar el hackatón"),
    p(
      "Porque no propone construir un sistema que ya existe. Ecuador ya tiene pronóstico hidrológico nacional a quince días sobre 2.300 tramos de río, la malla de comunicación offline ya está resuelta por debajo de veinte dólares por nodo, y las apps de reporte ciudadano ya se probaron y se sabe que mueren a los cincuenta días. La mayoría de las propuestas de este hackatón van a reconstruir una de esas tres cosas.",
    ),
    p(
      "Porque el insight no se obtiene por lluvia de ideas. Requiere haber leído que en Huaquillas la interrupción del suministro de agua fue el único factor de riesgo significativo, que Lowe midió un rezago de tres a cinco meses después de la sequía, y que la empresa de agua publica ese calendario por barrio e incluso ordena a la gente almacenar. Son tres literaturas que no se citan entre sí y una fuente administrativa que nadie considera un dato científico.",
    ),
    p(
      "Porque responde bien a las preguntas incómodas. No asume internet, no asume electricidad, no asume smartphones en manos de la comunidad, no asume alfabetización digital, no despliega hardware que nadie mantendrá, no pide presupuesto nuevo y no requiere que el usuario cambie de hábito. El brigadista camina las mismas manzanas que hoy, en otro orden.",
    ),
    p(
      "Y porque el momento es exacto. El CPC estima más del 90% de probabilidad de un evento muy fuerte para fin de 2026, el ERFEN ubica la mayor expresión entre noviembre y diciembre, el dengue ya lleva once semanas consecutivas por encima de 2025 con 91,5% de resistencia a la deltametrina, y hay fondos de acción anticipatoria buscando disparadores accionables antes de noviembre. La ventana de tres a cinco meses que este sistema explota se está abriendo mientras se presenta el proyecto.",
    ),
  ].join("\n"),
);

/* --- 11. Finalista B: AVAL VERDE ------------------------------------- */
add(
  "aval-verde",
  "Finalista B · AVAL VERDE",
  [
    `<p class="kicker">FINALISTA B · TRACK 3 · AGROTECNOLOGÍA</p>`,
    `<h3 class="big">AVAL VERDE</h3>`,
    lead(
      "Verificación remota de pérdida agrícola y reestructuración anticipatoria de crédito, vendida al prestamista y no al productor.",
    ),
    callout(
      "warning",
      "Esta propuesta cambió de forma durante la investigación",
      "La versión original, ACTA VERDE, proponía capturar evidencia de daño para que el productor pudiera reclamar. Dos hallazgos la obligaron a pivotar. Primero, esa idea ya existe, está publicada y evaluada: se llama Picture-Based Insurance y el IFPRI la probó con 750 productores en India. Segundo, y más decisivo, la literatura demuestra que el productor pequeño no compra seguro casi en ninguna parte del mundo, y en Ecuador solo lo hace cuando el banco se lo exige. Si el productor no es el comprador, el producto no puede estar diseñado para él.",
    ),
    h4("1. El problema en una frase"),
    p(
      "La agricultura concentra el 43% del daño económico de El Niño en Ecuador, pero solo el 0,17% de la superficie agropecuaria está asegurada, porque peritar la pérdida de una parcela de dos hectáreas cuesta más que la indemnización, y el seguro por índice que resuelve ese costo falla justamente cuando el productor sí perdió la cosecha.",
    ),
    h4("2. La evidencia de que el problema es real"),
    table(
      ["Hallazgo", "Fuente", "Fuerza"],
      [
        ["En El Niño 1997-98 el sector agropecuario y pesca perdió US$ 1.243,7 M, el 43,3% del daño nacional total de US$ 2.869,3 M. El plan de acción de la SGR proyectó para 2023-24 unas 945.504 hectáreas afectadas, el 44% de la superficie agrícola del país, con US$ 1.800 M de pérdidas.", "CEPAL, El Niño 1997-1998 en Ecuador; Plan de Acción Fenómeno El Niño, SGR", "Fuerte"],
        ["Hasta abril de 2023 había 15.247 hectáreas con pérdida total y 10.942 con pérdida parcial, pero solo 8.735 hectáreas aseguradas frente a los 5,2 millones de hectáreas de superficie agropecuaria: cerca del 0,17%. Según el IICA, los productores contratan el seguro únicamente cuando la entidad financiera lo exige para otorgar crédito.", "Ministerio de Agricultura y Ganadería; análisis del IICA sobre seguros agrícolas en Ecuador", "Fuerte"],
        ["El seguro por índice arrastra riesgo de base, que es su talón de Aquiles: cuando el índice no se activa pero el productor sí perdió, queda peor que si nunca hubiera comprado el seguro. Un productor muy averso al riesgo rechaza racionalmente ese contrato, y la adopción ha sido en general decepcionante.", "Carter, de Janvry, Sadoulet & Sarris, revisión de evidencia; Clarke (2016)", "Fuerte"],
        ["En parcelas pequeñas el problema no se arregla con mejores índices. Descomponiendo el riesgo de base, la heterogeneidad interna de la zona domina sobre la precisión del índice, de modo que la búsqueda del mejor índice es más bien fútil y el esfuerzo debería ir a definir zonas más homogéneas y pequeñas.", "Optimal index insurance and basis risk decomposition, aplicación a Kenia (arXiv); NBER WP 32618, Carter e Iglesias", "Fuerte"],
        ["La verificación por fotografía de teléfono funciona: identificó el 71,4% de los sitios con pérdida severa, frente al 34,4% de un índice simulado de rendimiento por área. El 63% de los productores capacitados subió al menos cuatro fotos por temporada. No se encontró evidencia de riesgo moral ni de selección adversa, y la disposición a pagar fue mayor que por el seguro por índice.", "Ceballos, Kramer & Robles, Development Engineering; evaluación 3ie con 750 productores en Haryana y Punjab, India", "Fuerte"],
        ["En 1998 la región costera absorbía el 63% del crédito bancario; la cartera vencida creció 76,7% y la morosidad llegó a 9,3% en diciembre de 1998. Hoy la banca pública registra 16,2% de morosidad general y 26% en su cartera productiva. Manabí destina el 19% de su cartera a agricultura y pesca, y Guayas el 12% de US$ 12.055 M.", "Banco Central del Ecuador, Apuntes de Economía No. 75 (2024), sobre cartera a junio de 2023", "Fuerte"],
        ["La verificación fotográfica solo detecta daño severo: en el piloto de India no logró identificar los sitios con daño moderado. Y aunque la disposición a pagar superó la del seguro por índice, en términos absolutos siguió siendo baja.", "Mismo estudio del IFPRI; es la limitación reconocida por los propios autores", "Limitación documentada"],
      ],
      { rowTone: ["success", "success", "success", "success", "success", "info", "warning"] },
    ),
    h4("3. El insight"),
    quote(
      "El cliente del seguro agrícola en Ecuador nunca fue el productor: es el banco. El productor solo se asegura cuando la entidad financiera lo exige como condición del crédito, y es el prestamista quien carga con la pérdida cuando la cosecha se inunda. Todas las insurtech de la región están corriendo a perfeccionar el índice climático, cuando la literatura dice que en parcelas pequeñas el índice no es la restricción que manda. La oportunidad no está en vender un seguro mejor al agricultor, está en darle al prestamista la capacidad de reestructurar el crédito antes de que llegue la inundación.",
    ),
    p(
      "El corolario es que el producto cambia de categoría. No es un seguro ni una app para agricultores: es infraestructura de riesgo crediticio climático. Y eso resuelve de un golpe las dos preguntas que hundían la versión anterior, que eran quién paga y quién sostiene el uso, porque el oficial de crédito ya visita la parcela al originar el préstamo.",
    ),
    h4("4. La solución en una frase"),
    p(
      "Una capa de verificación remota de pérdida que se instala en el flujo de originación de crédito agrícola, combinando el polígono y las fotos de línea base que el oficial ya levanta con corroboración satelital, y que usa el pronóstico de GEOGLOWS para decirle al prestamista qué créditos reestructurar antes de que se inunde la parcela.",
    ),
    h4("5. Cómo funciona, paso a paso"),
    table(
      ["Paso", "Qué ocurre"],
      [
        ["1", "Al originar el crédito, el oficial dibuja el polígono de la parcela y toma fotos de línea base desde puntos fijos georreferenciados. Es trabajo que ya hace en su visita de verificación, sin jornada adicional."],
        ["2", "Durante la campaña, el productor sube fotos desde los mismos puntos en los hitos fenológicos. Si no lo hace, el sistema no se cae: recurre a la serie de radar Sentinel-1, que atraviesa nubes, y a índices de vegetación."],
        ["3", "El motor mantiene por parcela una estimación de estado del cultivo y, agregando por zona, arma zonas de riesgo homogéneas y pequeñas en lugar de perseguir un índice más preciso, que es lo que la literatura señala como el error de diseño dominante."],
        ["4", "Con el pronóstico de caudal a quince días de GEOGLOWS y las manchas históricas de inundación, el sistema calcula qué parcelas de la cartera van a inundarse y produce una lista de créditos candidatos a reestructuración preventiva."],
        ["5", "Cuando ocurre el evento, la comparación entre línea base y estado posterior genera automáticamente un expediente de verificación de pérdida, con sello de tiempo y ubicación, apto para el reclamo de seguro o para la refinanciación."],
        ["6", "El prestamista ve un panel de exposición de cartera por parroquia, con pérdida esperada, y puede provisionar con anticipación en lugar de descubrir la mora tres meses después."],
      ],
      { align: ["center", "left"] },
    ),
    h4("6. Arquitectura y fuentes de datos"),
    table(
      ["Componente", "Origen y acceso"],
      [
        ["Captura de campo", "App offline-first para el oficial de crédito y el productor, con puntos fijos y sello de tiempo y ubicación"],
        ["Corroboración satelital", "Sentinel-1 y Sentinel-2, gratuitos; el radar atraviesa la nubosidad de la temporada lluviosa"],
        ["Pronóstico de inundación", "API de INAMHI-GEOGLOWS, abierta, 2.300 tramos de río a quince días"],
        ["Geografía de cartera", "Distribución de crédito por parroquia y actividad del Banco Central; el detalle de la cartera real requiere convenio con el prestamista"],
        ["Superficie y cultivos", "Sistema de Información Pública Agropecuaria del MAG y registro de productores"],
        ["Histórico de daño", "Reportes de afectación del MAG y siniestros del seguro agrícola subvencionado"],
        ["Motor de zonificación", "Agrupamiento por homogeneidad de rendimiento para minimizar riesgo de base"],
      ],
    ),
    h4("7. MVP y demo de tres minutos"),
    p(
      "El MVP tiene tres piezas: la captura offline con puntos fijos y generación de expediente; la corroboración con Sentinel-1 sobre un evento real de inundación en Guayas o Los Ríos; y el panel de exposición de cartera alimentado con la distribución de crédito agrícola por parroquia del Banco Central más el pronóstico de GEOGLOWS.",
    ),
    p(
      "La demo abre con el dato del 0,17% de superficie asegurada y la cifra de 24.983 hectáreas afectadas en dos meses de 2024. Luego muestra el expediente generado en modo avión y su corroboración satelital. Cierra con el panel: esta parroquia concentra tantos millones en crédito agrícola, GEOGLOWS dice que esta cuenca se desborda en doce días, y en 1998 la morosidad de la costa pasó de 7,3% a 9,3%. Aquí están los créditos que conviene reestructurar esta semana.",
    ),
    h4("8. Métricas, usuario, cliente y sostenibilidad"),
    table(
      ["Dimensión", "Respuesta"],
      [
        ["Métricas", "Tiempo entre evento y liquidación del reclamo; costo de verificación por hectárea frente al peritaje presencial; reducción del riesgo de base medido como porcentaje de pérdidas severas correctamente identificadas, con el 71,4% del IFPRI como referencia; y morosidad de la cartera intervenida frente a la comparable."],
        ["Usuario", "El oficial de crédito agrícola y, secundariamente, el productor."],
        ["Cliente que paga", "El prestamista: BanEcuador, la Corporación Financiera Nacional y las cooperativas del segmento 1 con cartera agrícola en la costa. Las aseguradoras son el segundo comprador y el MAG, que subvenciona la prima, el tercero."],
        ["Sostenibilidad", "Se cobra por hectárea verificada o por punto básico de cartera monitoreada, un modelo recurrente y atado a un presupuesto que ya existe: el costo de peritaje y provisiones que el prestamista paga hoy de forma más cara y más lenta."],
        ["Implementación y escala", "Convenio con un prestamista para una campaña de arroz en Guayas o Los Ríos, y validación retrospectiva contra siniestros ya pagados. Escala por cartera de prestamista, no por productor. Argentina incorporó los seguros paramétricos a su reglamento de actividad aseguradora en julio de 2026 (Resolución 315/2026), lo que abre un canal formal regional."],
      ],
    ),
    h4("9. Ventaja competitiva y riesgos, sin maquillaje"),
    callout(
      "danger",
      "El track agro está lleno de competidores financiados",
      "Guarda, en Brasil, levantó US$ 806 mil pre-semilla para seguros paramétricos satelitales y apunta a 10.000 hectáreas en 2026, con indemnización en treinta días y sin inspección de campo. TRAG, también brasileña, levantó R$ 2 millones y usa datos satelitales de programas de la NASA a nivel de lote con cuarenta años de histórico. YielData, de Argentina, convierte 42 años de datos climáticos en un índice de rendimiento en kilos por hectárea, ya cubrió productores una campaña y fue convocada por la NASA. Howden opera microseguros paramétricos en Colombia, México, Guatemala, Honduras, Costa Rica y El Salvador, y va hacia Perú. A esto se suma que el Banco Central del Ecuador ya publicó el mapeo de parroquias en riesgo y la pérdida esperada de la cartera de crédito.",
    ),
    p(
      "La ventaja defendible frente a ellos es estrecha pero real: todos resuelven el costo de peritaje eliminando la verificación de campo, y por eso todos cargan con riesgo de base, que es exactamente lo que la literatura identifica como la causa de la baja adopción. Nosotros verificamos, a costo casi nulo, aprovechando una visita que el oficial de crédito ya hace. Y ninguno de ellos está en el negocio del crédito, así que ninguno puede ofrecer reestructuración anticipada.",
    ),
    table(
      ["Riesgo", "Severidad", "Mitigación honesta"],
      [
        ["El comprador es un banco, con ciclo de venta de meses o años y aversión a pilotos. Nada de esto se valida en un fin de semana.", "Alta", "Ninguna satisfactoria en el horizonte del hackatón. Es la debilidad estructural de la propuesta."],
        ["Cuatro competidores financiados, uno con relación con la NASA y viento regulatorio a favor en Argentina.", "Alta", "Diferenciarse por verificación real en lugar de índice, y por el ángulo crediticio. Pero es una carrera contra equipos con capital."],
        ["La verificación fotográfica solo detecta daño severo, no moderado, según el propio piloto del IFPRI.", "Media", "Posicionar el producto como cobertura catastrófica, no como seguro integral. Es honesto y sigue siendo útil."],
        ["Sin la cartera real del prestamista, el panel de exposición se construye sobre agregados por parroquia del Banco Central.", "Media", "Suficiente para demostrar el concepto, insuficiente para operar. Requiere el convenio."],
        ["La disposición a pagar del productor es baja incluso cuando percibe menor riesgo de base.", "Baja", "Es precisamente la razón del pivote: no le vendemos al productor."],
      ],
      { rowTone: ["danger", "danger", "warning", "warning", "info"] },
    ),
    h4("10. Por qué podría ganar y por qué podría perder"),
    p(
      "Podría ganar porque ataca el track que concentra el 43% del daño, con la cifra más contundente de todo el análisis: el 0,17% de la superficie agropecuaria asegurada. Porque el mecanismo de verificación no es una apuesta, está validado con números publicados de 71,4% contra 34,4%. Y porque el pivote al prestamista responde con precisión la pregunta que hunde a la mayoría de los proyectos de hackatón, que es quién paga.",
    ),
    p(
      "Podría perder porque compite contra cuatro empresas financiadas en el mismo espacio, porque su comprador tiene un ciclo de decisión de meses, y porque la parte más innovadora —la reestructuración anticipada de crédito— es también la más difícil de demostrar en tres minutos frente a un jurado.",
    ),
  ].join("\n"),
);

/* ------------------------------------------------------------- render ---- */

const nav = sections
  .map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`)
  .join("");

const body = sections
  .map(
    (s) => `<section id="${s.id}">
${h2(s.title)}
${s.html}
</section>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resiliencia climática ante El Niño · Análisis de problemas y propuesta · Hackatón Quito</title>
<meta name="description" content="Investigación de problemas, estado del arte, priorización, red team y propuesta ganadora para el desafío de resiliencia climática ante El Niño en Ecuador, Perú y Colombia.">
<style>
:root{
  --bg:#ffffff; --panel:#f7f8fa; --ink:#14161a; --ink2:#4a5058; --ink3:#7b828c;
  --line:#e3e6ea; --accent:#1c5fd6;
  --danger:#d1382c; --warning:#c07a14; --info:#1c5fd6; --success:#177a4a; --neutral:#9aa2ac;
  --maxw:980px;
}
@media (prefers-color-scheme:dark){
  :root{ --bg:#0f1115; --panel:#161920; --ink:#e8eaee; --ink2:#a8b0ba; --ink3:#767e89;
         --line:#262b34; --accent:#5b93f5; --danger:#ef6a5c; --warning:#e0a53c;
         --info:#5b93f5; --success:#3fae76; --neutral:#5a626d; }
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
.wrap{display:grid;grid-template-columns:250px minmax(0,1fr);gap:44px;max-width:1320px;margin:0 auto;padding:0 28px}
nav{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;padding:34px 0;border-right:1px solid var(--line)}
nav .brand{font-weight:700;font-size:14px;letter-spacing:.02em;margin-bottom:4px}
nav .sub{font-size:12px;color:var(--ink3);margin-bottom:20px;line-height:1.45}
nav a{display:block;padding:7px 12px 7px 0;color:var(--ink2);text-decoration:none;font-size:13.5px;border-left:2px solid transparent;padding-left:12px}
nav a:hover{color:var(--ink);border-left-color:var(--accent)}
main{padding:34px 0 100px;max-width:var(--maxw)}
header.hero{padding:26px 0 34px;border-bottom:1px solid var(--line);margin-bottom:12px}
header.hero h1{font-size:31px;line-height:1.2;margin:0 0 12px;letter-spacing:-.015em}
header.hero p{color:var(--ink2);margin:0 0 8px;max-width:70ch}
header.hero .meta{font-size:13px;color:var(--ink3);margin-top:16px}
section{padding:38px 0;border-bottom:1px solid var(--line)}
section:last-child{border-bottom:0}
h2{font-size:23px;margin:0 0 6px;letter-spacing:-.01em}
h3{font-size:18px;margin:26px 0 8px}
h3.big{font-size:27px;margin:2px 0 6px;letter-spacing:-.01em}
h4{font-size:14.5px;margin:20px 0 6px;color:var(--ink2);font-weight:650}
p{margin:0 0 12px;max-width:78ch}
p.lead{color:var(--ink2);font-size:15.5px}
p.note{font-size:12.5px;color:var(--ink3);margin-top:-2px}
p.kicker{font-size:11.5px;letter-spacing:.09em;font-weight:700;color:var(--accent);margin:0 0 4px}
p.tag{font-size:12px;font-weight:600;margin:10px 0 0}
blockquote{margin:14px 0;padding:2px 0 2px 18px;border-left:2px solid var(--accent);
  color:var(--ink);font-size:15.5px;max-width:78ch}
.callout{border:1px solid var(--line);border-left:3px solid var(--neutral);background:var(--panel);
  padding:14px 16px;border-radius:6px;margin:16px 0;font-size:14.5px;color:var(--ink2)}
.callout .callout-title{font-weight:650;color:var(--ink);margin-bottom:5px;font-size:14.5px}
.callout.danger{border-left-color:var(--danger)}
.callout.warning{border-left-color:var(--warning)}
.callout.info{border-left-color:var(--info)}
.callout.success{border-left-color:var(--success)}
.tw{overflow-x:auto;margin:12px 0 18px;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--panel);font-weight:650;font-size:12.5px;color:var(--ink2);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
tbody tr:nth-child(even){background:color-mix(in srgb,var(--panel) 55%,transparent)}
td:first-child{font-weight:550}
.a-center{text-align:center}.a-right{text-align:right}
tr.t-danger td:first-child{box-shadow:inset 3px 0 0 var(--danger)}
tr.t-warning td:first-child{box-shadow:inset 3px 0 0 var(--warning)}
tr.t-info td:first-child{box-shadow:inset 3px 0 0 var(--info)}
tr.t-success td:first-child{box-shadow:inset 3px 0 0 var(--success)}
details.card{border:1px solid var(--line);border-radius:6px;margin:9px 0;background:var(--panel)}
details.card summary{cursor:pointer;padding:12px 15px;font-weight:600;font-size:14.5px;
  display:flex;gap:14px;align-items:flex-start;justify-content:space-between;list-style:none}
details.card summary::-webkit-details-marker{display:none}
details.card summary::before{content:"▸";color:var(--ink3);flex:0 0 auto;transform:translateY(1px)}
details.card[open] summary::before{content:"▾"}
details.card summary span{flex:1}
details.card summary em{font-style:normal;font-size:12px;color:var(--ink3);white-space:nowrap;font-weight:500}
.card-body{padding:2px 15px 15px;background:var(--bg);border-top:1px solid var(--line);
  border-radius:0 0 6px 6px}
.card-body h4:first-child{margin-top:14px}
ul.rt{margin:6px 0 0;padding-left:18px}
ul.rt li{margin-bottom:8px;color:var(--ink2);font-size:14.5px;max-width:78ch}
ul.rt li:last-child{color:var(--ink);font-weight:500}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0 6px}
.stat{flex:1 1 165px;border:1px solid var(--line);border-radius:6px;padding:13px 15px;background:var(--panel)}
.stat b{display:block;font-size:25px;line-height:1.15;letter-spacing:-.02em}
.stat span{display:block;font-size:12px;color:var(--ink3);margin-top:5px;line-height:1.4}
.stat.t-danger b{color:var(--danger)}.stat.t-warning b{color:var(--warning)}
.stat.t-info b{color:var(--info)}.stat.t-success b{color:var(--success)}
.bars{margin:12px 0 6px}
.bar-row{display:grid;grid-template-columns:minmax(120px,230px) 1fr 96px;gap:12px;align-items:center;
  margin-bottom:7px;font-size:13px}
.bar-label{color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{background:var(--panel);border-radius:3px;height:17px;overflow:hidden;
  border:1px solid var(--line);position:relative}
.bar-track.dual{height:23px;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:2px}
.bar-fill{display:block;height:100%;border-radius:2px;background:var(--accent);min-width:2px}
.bar-track.dual .bar-fill{height:8px}
.bar-fill.t-danger{background:var(--danger)}.bar-fill.t-warning{background:var(--warning)}
.bar-fill.t-info{background:var(--info)}.bar-fill.t-success{background:var(--success)}
.bar-fill.t-neutral{background:var(--neutral)}.bar-fill.t-accent{background:var(--accent)}
.bar-fill.a{background:var(--success)}.bar-fill.b{background:var(--info)}
.bar-value{text-align:right;color:var(--ink3);font-variant-numeric:tabular-nums;font-size:12.5px}
.legend{display:flex;gap:18px;font-size:12.5px;color:var(--ink2);margin:8px 0 4px}
.legend .sw,.donut-legend .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}
.legend .sw.a{background:var(--success)}.legend .sw.b{background:var(--info)}
.donut-wrap{display:flex;gap:26px;align-items:center;flex-wrap:wrap;margin:14px 0}
.donut{width:150px;height:150px;border-radius:50%;flex:0 0 auto;
  -webkit-mask:radial-gradient(circle,transparent 52%,#000 53%);
  mask:radial-gradient(circle,transparent 52%,#000 53%)}
.donut-legend{list-style:none;margin:0;padding:0;font-size:13px;color:var(--ink2)}
.donut-legend li{margin-bottom:6px}
.donut-legend b{color:var(--ink);font-variant-numeric:tabular-nums}
footer{padding:34px 0 60px;color:var(--ink3);font-size:12.5px;max-width:78ch}
@media (max-width:900px){
  .wrap{grid-template-columns:1fr;gap:0;padding:0 18px}
  nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line);padding:22px 0}
  nav a{display:inline-block;border-left:0;border-bottom:2px solid transparent;padding:5px 12px 5px 0;margin-right:6px}
  .bar-row{grid-template-columns:1fr;gap:3px}
  .bar-value{text-align:left}
}
@media print{
  nav{display:none}
  .wrap{display:block;max-width:none;padding:0}
  main{max-width:none;padding:0}
  body{font-size:10.5pt;color:#000;background:#fff}
  details.card{border:1px solid #ccc;background:#fff;break-inside:avoid}
  details.card:not([open])>.card-body{display:block !important}
  details.card summary::before{content:""}
  section{break-inside:auto;page-break-inside:auto;border-bottom:1px solid #ddd}
  h2,h3,h4{break-after:avoid}
  .tw{overflow:visible;break-inside:auto}
  tr{break-inside:avoid}
  a{color:#000;text-decoration:none}
}
</style>
</head>
<body>
<div class="wrap">
<nav>
  <div class="brand">Resiliencia climática ante El Niño</div>
  <div class="sub">Investigación de problemas y propuesta<br>Hackatón Quito · Ecuador, Perú, Colombia</div>
  ${nav}
</nav>
<main>
<header class="hero">
  <h1>Resiliencia climática ante El Niño: qué problema atacar y por qué</h1>
  <p>Investigación de problemas, revisión de evidencia académica, estado del arte institucional, matriz de priorización, generación de soluciones, crítica adversarial y dos propuestas finalistas desarrolladas al mismo nivel de detalle.</p>
  <p>El documento está construido sobre una regla: ninguna afirmación relevante se presenta sin fuente, y cada pieza de evidencia está etiquetada por su fuerza. Las inferencias propias aparecen marcadas como hipótesis y no como hallazgos, incluidas las que sostienen la propuesta recomendada.</p>
  <div class="meta">${sections.length} secciones · ${EVIDENCE.length} hallazgos con fuente · ${PROBLEMS.length} problemas · ${SOLUTIONS.length} soluciones evaluadas y sometidas a red team · generado el ${new Date().toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}</div>
</header>
${body}
<footer>
  <p><strong>Sobre las fuentes.</strong> Las cifras cuantitativas provienen de fuentes oficiales (CEPAL, Banco Central del Ecuador, Ministerio de Salud Pública, Ministerio de Agricultura y Ganadería, Secretaría de Gestión de Riesgos, INAMHI, INSPI, CPC/NOAA, ENFEN, OPS) y de literatura revisada por pares. Las puntuaciones de las matrices de priorización son juicio analítico propio, explícitamente subjetivo, y se muestran desagregadas por criterio para que puedan ser discutidas y modificadas.</p>
  <p>Para convertir este documento a PDF: abrirlo en el navegador e imprimir con destino "Guardar como PDF". Las secciones plegables se imprimen desplegadas.</p>
</footer>
</main>
</div>
</body>
</html>`;

fs.writeFileSync(OUT, html, "utf8");
console.log("Informe generado: " + OUT);
console.log(
  `  ${sections.length} secciones · ${EVIDENCE.length} evidencias · ${PROBLEMS.length} problemas · ${SOLUTIONS.length} soluciones · ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`,
);
