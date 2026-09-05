/** Comprobación rápida de que la malla H3 tiene la escala que afirmamos. */
import { cellToBoundary } from "h3-js";
import {
  celdaDesde,
  centroide,
  cercoDe,
  distanciaM,
  etiquetaMinizona,
  mallaDeSector,
  ordenarPorCercania,
  RESOLUCION_MINIZONA,
} from "../lib/geo/minizonas";

const GUAYAQUIL = { lat: -2.1894, lon: -79.8891 };

const celda = celdaDesde(GUAYAQUIL.lat, GUAYAQUIL.lon);
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
console.log(`etiquetas del cerco: ${anillo.map(etiquetaMinizona).join(" ")}`);

for (const r of [300, 500, 800]) {
  const malla = mallaDeSector(GUAYAQUIL, r);
  const dmax = Math.max(...malla.map((h) => distanciaM(centroide(h), GUAYAQUIL)));
  console.log(`malla r=${r} m -> ${malla.length} minizonas, la más lejana a ${dmax.toFixed(0)} m`);
}

const muestra = mallaDeSector(GUAYAQUIL, 300).map((h) => ({ h3: h, ...centroide(h) }));
const ruta = ordenarPorCercania(muestra);
let largo = 0;
for (let i = 1; i < ruta.length; i++) largo += distanciaM(ruta[i - 1], ruta[i]);
let largoOriginal = 0;
for (let i = 1; i < muestra.length; i++) largoOriginal += distanciaM(muestra[i - 1], muestra[i]);
console.log(
  `ruta ${ruta.length} minizonas: ${largo.toFixed(0)} m ordenada vs ${largoOriginal.toFixed(0)} m sin ordenar`
);
