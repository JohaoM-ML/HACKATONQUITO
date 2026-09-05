/**
 * Minizonas: muestreo por conglomerados a la escala de vuelo de Aedes aegypti.
 *
 * Los estudios de marca-liberación-recaptura muestran que el vector rara vez se aleja
 * más de ~100 m de donde emergió, y los protocolos de bloqueo ante un caso tratan un
 * radio de 200–300 m. De ahí salen las dos constantes de este módulo:
 *
 *   RESOLUCION_MINIZONA = 10  -> celda de ~160 m de ancho, contiene el rango de vuelo
 *   K_CERCO             = 1   -> celda + 6 vecinas, ~220 m de radio ≈ radio de bloqueo
 *
 * Medido en Guayaquil con scripts/check-geo.ts: las celdas H3 crecen cerca del ecuador,
 * así que aquí salen algo mayores que la media global publicada para la resolución 10.
 *
 * Usamos H3 (malla hexagonal global) en vez de polígonos oficiales porque en Guayaquil
 * no tenemos límites de barrio publicados: la celda se deriva del GPS, así que dos
 * brigadistas parados en la misma cuadra obtienen el mismo identificador sin coordinarse.
 */

import {
  cellToBoundary,
  cellToLatLng,
  greatCircleDistance,
  gridDisk,
  gridRing,
  latLngToCell,
  UNITS,
} from "h3-js";

export const RESOLUCION_MINIZONA = 10;
export const K_CERCO = 1;

/** Viviendas inspeccionadas que dan por cubierta una minizona. */
export const META_VIVIENDAS_MINIZONA = 5;

/**
 * Cupo diario por brigadista. 8 celdas × 5 viviendas ≈ 40 casas.
 * A ~2–3 min por vivienda + caminata entre hexágonos de ~160 m (~1.3 km)
 * es una jornada de campo realista. El resto del bloque asignado queda
 * para los días siguientes: así se cubre el perímetro sin cruzarse
 * con otro brigadista (cada uno tiene un tramo geográfico distinto).
 */
export const META_MINIZONAS_DIA = 8;

/**
 * Radios que puede asignar el sistema al delimitar un sector, en metros.
 * Calibrados para que el tramo generado sea recorrible por la brigada asignada
 * en, como mucho, un día de trabajo (META_MINIZONAS_DIA = 8 celdas/brigadista):
 * 600 m ≈ 65 celdas (todo el equipo en un día), 150 m ≈ 4 celdas (una persona,
 * media jornada). Antes llegaban a 1200 m (~260 celdas): imposible de cubrir.
 */
export const RADIOS_SECTOR = [150, 250, 400, 600] as const;

/**
 * Centros públicos aproximados para sectores que no se pueden geocodificar
 * (sin clave de Google o resultado fuera de Guayaquil). El jefe ya no corrige esto
 * a mano; si un sector no aparece aquí y tampoco geocodifica, queda "sin ubicar"
 * en vez de inventarle coordenadas — ver `resolverCentro` en la API de generación.
 */
export const CENTROS_PUBLICOS: Record<string, LatLon> = {
  "cristo-del-consuelo": { lat: -2.2184, lon: -79.9182 },
  fertisa: { lat: -2.2368, lon: -79.9004 },
  guasmo: { lat: -2.2465, lon: -79.8942 },
  "isla-trinitaria": { lat: -2.2258, lon: -79.9106 },
  "la-floresta": { lat: -2.2319, lon: -79.8881 },
  "las-malvinas": { lat: -2.2147, lon: -79.9053 },
  "Cristo del Consuelo": { lat: -2.2184, lon: -79.9182 },
  Fertisa: { lat: -2.2368, lon: -79.9004 },
  Guasmo: { lat: -2.2465, lon: -79.8942 },
  "Isla Trinitaria": { lat: -2.2258, lon: -79.9106 },
  "La Floresta": { lat: -2.2319, lon: -79.8881 },
  "Las Malvinas": { lat: -2.2147, lon: -79.9053 },
};

export type LatLon = { lat: number; lon: number };

/**
 * Radio de cobertura que decide el sistema, a partir del puntaje real del motor de
 * reglas (corte de agua + almacenamiento + bonus de tendencia). Ya no lo elige el jefe:
 * el jefe supervisa el resultado, no lo configura.
 *
 * Regla A (corte confirmado + almacenamiento pedido) cubre más terreno porque el riesgo
 * ya está confirmado. Regla B es una hipótesis sin validar (ver reglas.ts): se cubre un
 * radio menor, más exploratorio, hasta que una visita la confirme o la descarte.
 */
export function radioAutomatico(regla: "A" | "B" | "C" | null, puntaje: number): number {
  if (regla === "A") return puntaje >= 90 ? RADIOS_SECTOR[3] : RADIOS_SECTOR[2];
  if (regla === "B") return puntaje >= 45 ? RADIOS_SECTOR[1] : RADIOS_SECTOR[0];
  return RADIOS_SECTOR[0];
}

/** Celda H3 que contiene un punto GPS. */
export function celdaDesde(lat: number, lon: number): string {
  return latLngToCell(lat, lon, RESOLUCION_MINIZONA);
}

/** Centroide de una celda. */
export function centroide(h3: string): LatLon {
  const [lat, lon] = cellToLatLng(h3);
  return { lat, lon };
}

/** Vértices del hexágono, en el formato que espera google.maps.Polygon. */
export function contorno(h3: string): { lat: number; lng: number }[] {
  return cellToBoundary(h3).map(([lat, lng]) => ({ lat, lng }));
}

export function distanciaM(a: LatLon, b: LatLon): number {
  return greatCircleDistance([a.lat, a.lon], [b.lat, b.lon], UNITS.m);
}

/**
 * Malla de minizonas que cubre un disco alrededor del centro del sector.
 * Se sobre-genera con gridDisk y luego se recorta por distancia real, para que el
 * resultado sea un círculo y no un hexágono grande.
 */
export function mallaDeSector(centro: LatLon, radioM: number): string[] {
  // Arista deliberadamente por lo bajo: sobre-generar y recortar es barato, quedarse
  // corto dejaría huecos en el borde del sector.
  const arista = 66;
  const k = Math.max(1, Math.ceil(radioM / arista));
  const origen = celdaDesde(centro.lat, centro.lon);
  return gridDisk(origen, k).filter((c) => distanciaM(centroide(c), centro) <= radioM);
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

/**
 * Ordena las celdas asignadas a una persona por el campo `orden` que dejó el reparto;
 * si todavía no tiene orden (asignación vieja), cae a vecino más cercano.
 * Compartido entre la vista del brigadista y los resúmenes del jefe (panel/equipo)
 * para que "cuántas le tocan hoy" salga igual en todos lados.
 */
export function celdasEnOrden<T>(items: { orden: number | null; minizonas: T | null }[]): T[] {
  const filas = items.filter(
    (i): i is { orden: number | null; minizonas: T } => i.minizonas != null
  );
  if (!filas.length) return [];
  if (filas.some((i) => i.orden == null)) {
    // Solo pasa con asignaciones muy viejas, de antes de guardar `orden`.
    return ordenarPorCercania(filas.map((i) => i.minizonas) as (T & LatLon)[]) as T[];
  }
  return [...filas]
    .sort((a, b) => (a.orden as number) - (b.orden as number))
    .map((i) => i.minizonas);
}

/** Primeras META_MINIZONAS_DIA celdas aún no cubiertas, en orden de caminata del bloque. */
export function rutaDelDia<T extends { estado: string }>(celdas: T[]): T[] {
  return celdas.filter((m) => m.estado !== "cubierta").slice(0, META_MINIZONAS_DIA);
}

/** Largo total de un recorrido, para mostrarle al brigadista cuánto va a caminar. */
export function largoRutaM(puntos: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += distanciaM(puntos[i - 1], puntos[i]);
  return Math.round(total);
}

/**
 * Etiqueta corta y legible para una celda. Los índices H3 de resolución 10 se rellenan
 * con 'f' a la derecha, así que hay que quitar ese relleno antes de recortar: si no,
 * todas las minizonas se llamarían igual.
 */
export function etiquetaMinizona(h3: string): string {
  return "MZ-" + h3.replace(/f+$/, "").slice(-4).toUpperCase();
}
