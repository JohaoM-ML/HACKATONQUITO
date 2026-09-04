/**
 * Expande cortes_interagua_clean.csv → una fila por sector en sectores_ejemplo.
 * NO añade topónimos que no estén en el CSV.
 */

"use strict";

const fs = require("fs");
const path = require("path");

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] !== undefined ? cols[i] : "";
    });
    return row;
  });
}

function slugify(nombre) {
  return String(nombre)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Filtra filas genéricas que no son barrios nombrados.
 */
function esSectorNombrado(nombre) {
  const n = nombre.trim().toLowerCase();
  if (!n) return false;
  if (/^\d+\s*sectores/.test(n)) return false;
  if (n.includes("sectores de la ciudad")) return false;
  if (n.includes("sectores en comunicado")) return false;
  if (n === "via a la costa" || n === "vía a la costa") return false;
  if (n.includes("guayaquil y parroquias")) return false;
  if (n.includes("toda la ciudad")) return false;
  return true;
}

function inferirZona(zonaCiudad, nombre) {
  const z = String(zonaCiudad || "").toLowerCase();
  const n = String(nombre || "").toLowerCase();
  if (n.includes("guasmo") || n.includes("trinitaria") || n.includes("consuelo") || n.includes("fertisa") || n.includes("floresta") || n.includes("malvinas")) {
    if (z.includes("sur")) return "Sur";
  }
  if (z.includes("sur") && !z.includes("norte")) return "Sur";
  if (z.includes("norte") && !z.includes("sur")) return "Norte";
  if (z.includes("norte") && z.includes("sur")) return "Norte/Centro/Sur";
  return zonaCiudad || "unknown";
}

/**
 * Expande un evento CSV a filas barrio.
 */
function expandirEvento(row) {
  const sectores = String(row.sectores_ejemplo || "")
    .split(";")
    .map((s) => s.trim())
    .filter(esSectorNombrado);

  return sectores.map((nombre) => ({
    id: slugify(nombre),
    nombre,
    zona: inferirZona(row.zona_ciudad, nombre),
    fecha_corte: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    duracion_horas: row.duracion_horas || "",
    duracion_horas_num:
      row.duracion_horas_num !== "" && row.duracion_horas_num != null
        ? Number(row.duracion_horas_num)
        : null,
    duracion_es_rango: row.duracion_es_rango === "1" || row.duracion_es_rango === 1,
    duracion_incompleta: row.duracion_incompleta === "1" || row.duracion_incompleta === 1,
    pidio_almacenar: row.pidio_almacenar,
    almacenar: row.almacenar,
    motivo: row.motivo,
    tipo_corte: row.tipo_corte,
    fuente: row.fuente,
    fuente_url: row.url,
    confianza: row.confianza || "B",
    zona_ciudad: row.zona_ciudad,
    n_sectores_listados: row.n_sectores_listados,
    lat: null,
    lon: null,
    origen_lista: "sectores_ejemplo",
    nota_lista: "Lista de ejemplo del comunicado/prensa; puede ser incompleta.",
  }));
}

function extraerBarriosDesdeCsv(csvPath) {
  const rows = readCsv(csvPath);
  const barrios = [];
  for (const row of rows) {
    barrios.push(...expandirEvento(row));
  }
  return barrios;
}

function barriosToCsv(barrios) {
  const headers = [
    "id",
    "nombre",
    "zona",
    "fecha_corte",
    "fecha_fin",
    "duracion_horas",
    "duracion_horas_num",
    "pidio_almacenar",
    "fuente",
    "fuente_url",
    "confianza",
    "lat",
    "lon",
    "origen_lista",
  ];
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const b of barrios) {
    lines.push(headers.map((h) => esc(b[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

module.exports = {
  parseCsvLine,
  readCsv,
  slugify,
  esSectorNombrado,
  expandirEvento,
  extraerBarriosDesdeCsv,
  barriosToCsv,
};

if (require.main === module) {
  const root = path.resolve(__dirname, "../..");
  const csvPath = path.join(root, "data/clean/cortes_interagua_clean.csv");
  const outPath = path.join(root, "data/barrios_cortes.csv");
  const barrios = extraerBarriosDesdeCsv(csvPath);
  fs.writeFileSync(outPath, barriosToCsv(barrios), "utf8");
  console.log(`Escritos ${barrios.length} barrios/sectores → ${outPath}`);
}
