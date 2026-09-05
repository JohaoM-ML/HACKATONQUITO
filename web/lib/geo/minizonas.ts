/**
 * Minizonas: malla hexagonal H3 sobre el casco urbano de Guayaquil.
 *
 * Resolución 8 → celdas de ~1.1 km cerca del ecuador. En el mapa de ciudad se lee
 * como panal, no como manchas de 500 m. El cerco cubre ~1.6 km alrededor de un foco.
 *
 * Usamos H3 en vez de polígonos oficiales: la celda sale del GPS, así que dos
 * brigadistas en la misma cuadra obtienen el mismo identificador sin coordinarse.
 */

import {
  cellToBoundary,
  cellToLatLng,
  greatCircleDistance,
  gridDisk,
  gridRing,
  latLngToCell,
  polygonToCells,
  UNITS,
} from "h3-js";
import { GUAYAQUIL_URBANO_GEOJSON, SECTORES_GUAYAQUIL } from "./guayaquil";

export const RESOLUCION_MINIZONA = 8;
export const K_CERCO = 1;
export const ANCHO_MINIZONA_M = 1100;

/** Viviendas inspeccionadas que dan por cubierta una minizona. */
export const META_VIVIENDAS_MINIZONA = 5;

/**
 * Cupo diario por brigadista. 5 celdas × 5 viviendas ≈ 25 casas.
 * Entre hexágonos de ~1 km es una jornada de campo realista.
 */
export const META_MINIZONAS_DIA = 5;

/** Radios ofrecidos al jefe al delimitar un sector suelto, en metros. */
export const RADIOS_SECTOR = [2000, 4000, 6000, 8000] as const;

export type LatLon = { lat: number; lon: number };

export type CeldaAsignada = {
  h3: string;
  lat: number;
  lon: number;
  slug: string;
};

/** Celda H3 que contiene un punto GPS. */
export function celdaDesde(lat: number, lon: number): string {
  return latLngToCell(lat, lon, RESOLUCION_MINIZONA);
}

/** Centroide de una celda. */
export function centroide(h3: string): LatLon {
  const [lat, lon] = cellToLatLng(h3);
  return { lat, lon };
}

/** Vértices del hexágono, anillo cerrado para google.maps.Polygon. */
export function contorno(h3: string): { lat: number; lng: number }[] {
  const ring = cellToBoundary(h3).map(([lat, lng]) => ({ lat, lng }));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first.lat !== last.lat || first.lng !== last.lng)) {
    ring.push({ ...first });
  }
  return ring;
}

export function distanciaM(a: LatLon, b: LatLon): number {
  return greatCircleDistance([a.lat, a.lon], [b.lat, b.lon], UNITS.m);
}

function sectorMasCercano(punto: LatLon): string {
  let slug = SECTORES_GUAYAQUIL[0].slug;
  let mejor = Infinity;
  for (const s of SECTORES_GUAYAQUIL) {
    const d = distanciaM(punto, s);
    if (d < mejor) {
      mejor = d;
      slug = s.slug;
    }
  }
  return slug;
}

/**
 * Panal que cubre el casco urbano. Cada celda queda en el sector cuyo
 * centro público está más cerca (partición tipo Voronoi sobre H3).
 */
export function mallaDeGuayaquil(): CeldaAsignada[] {
  const celdas = polygonToCells(GUAYAQUIL_URBANO_GEOJSON, RESOLUCION_MINIZONA, true);
  return celdas.map((h3) => {
    const c = centroide(h3);
    return { h3, lat: c.lat, lon: c.lon, slug: sectorMasCercano(c) };
  });
}

/**
 * Malla local alrededor de un centro. Se deja como disco hexagonal
 * (sin recorte circular) para que el borde teselice.
 */
export function mallaDeSector(centro: LatLon, radioM: number): string[] {
  const arista = 460;
  const k = Math.max(1, Math.ceil(radioM / arista));
  return gridDisk(celdaDesde(centro.lat, centro.lon), k);
}

/**
 * Cerco perifocal: las celdas vecinas a un foco, que quedan pendientes de inspección.
 * No incluye la celda del propio foco (esa ya se está inspeccionando).
 */
export function cercoDe(h3Foco: string): string[] {
  return gridRing(h3Foco, K_CERCO);
}

/**
 * Orden de recorrido por vecino más cercano. Sirve sobre todo para que el reparto
 * entre brigadistas salga en bloques contiguos: sobre una malla hexagonal el ahorro
 * de camino frente al orden natural de la malla es marginal.
 */
export function ordenarPorCercania<T extends LatLon>(puntos: T[], inicio?: LatLon): T[] {
  if (puntos.length <= 2) return [...puntos];

  const pendientes = [...puntos];
  const ruta: T[] = [];
  let actual: LatLon = inicio ?? pendientes[0];

  while (pendientes.length) {
    let mejor = 0;
    let mejorD = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      const d = distanciaM(actual, pendientes[i]);
      if (d < mejorD) {
        mejorD = d;
        mejor = i;
      }
    }
    const [elegido] = pendientes.splice(mejor, 1);
    ruta.push(elegido);
    actual = elegido;
  }
  return ruta;
}

/** Largo total de un recorrido, para mostrarle al brigadista cuánto va a caminar. */
export function largoRutaM(puntos: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += distanciaM(puntos[i - 1], puntos[i]);
  return Math.round(total);
}

/**
 * Etiqueta corta y legible para una celda. Los índices H3 se rellenan con 'f'
 * a la derecha; hay que quitar ese relleno antes de recortar.
 */
export function etiquetaMinizona(h3: string): string {
  return "MZ-" + h3.replace(/f+$/, "").slice(-4).toUpperCase();
}
