/** Comprobación rápida de que la malla H3 tiene la escala que afirmamos. */
import { cellToBoundary } from "h3-js";
import { CENTRO_GUAYAQUIL } from "../lib/geo/guayaquil";
import {
  celdaDesde,
  centroide,
  cercoDe,
  distanciaM,
  etiquetaMinizona,
  mallaDeGuayaquil,
  mallaDeSector,
  RESOLUCION_MINIZONA,
} from "../lib/geo/minizonas";

const GYE = { lat: CENTRO_GUAYAQUIL.lat, lon: CENTRO_GUAYAQUIL.lng };

const celda = celdaDesde(GYE.lat, GYE.lon);
const borde = cellToBoundary(celda).map(([lat, lon]) => ({ lat, lon }));
const c = centroide(celda);

const radios = borde.map((b) => distanciaM(c, b));
const ancho = 2 * (radios.reduce((a, b) => a + b, 0) / radios.length);

console.log(`resolución H3: ${RESOLUCION_MINIZONA}`);
console.log(`celda: ${celda} (${etiquetaMinizona(celda)})`);
console.log(`ancho medio de la minizona: ${ancho.toFixed(0)} m`);

const anillo = cercoDe(celda);
const distCerco = anillo.map((h) => distanciaM(c, centroide(h)));
const radioCerco = Math.max(...distCerco) + ancho / 2;
console.log(`cerco: ${anillo.length} vecinas, centros a ${Math.max(...distCerco).toFixed(0)} m`);
console.log(`cerco: cubre un radio de ${radioCerco.toFixed(0)} m alrededor del foco`);

for (const r of [2000, 4000, 8000]) {
  const malla = mallaDeSector(GYE, r);
  const dmax = Math.max(...malla.map((h) => distanciaM(centroide(h), GYE)));
  console.log(`malla r=${r} m -> ${malla.length} minizonas, la más lejana a ${dmax.toFixed(0)} m`);
}

const ciudad = mallaDeGuayaquil();
const lats = ciudad.map((x) => x.lat);
const lons = ciudad.map((x) => x.lon);
console.log(`ciudad: ${ciudad.length} celdas`);
console.log(
  `bbox: lat ${Math.min(...lats).toFixed(3)}..${Math.max(...lats).toFixed(3)}  lon ${Math.min(...lons).toFixed(3)}..${Math.max(...lons).toFixed(3)}`
);
const conteo = new Map<string, number>();
for (const x of ciudad) conteo.set(x.slug, (conteo.get(x.slug) || 0) + 1);
for (const [slug, n] of [...conteo.entries()].sort()) console.log(`  ${slug}: ${n}`);
