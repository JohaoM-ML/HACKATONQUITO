/**
 * Geografía urbana de Guayaquil para la malla de minizonas.
 *
 * El anillo cubre el casco urbano (Pascuales → Guasmo, estero → vía a la costa)
 * y deja fuera Durán, Samborondón y el campo. Coordenadas GeoJSON [lng, lat].
 */

export const CENTRO_GUAYAQUIL = { lat: -2.1894, lng: -79.8891 };

/** Anillo exterior del área urbana compacta. Cerrado. */
export const GUAYAQUIL_URBANO_GEOJSON: number[][][] = [
  [
    [-79.942, -2.038],
    [-79.888, -2.042],
    [-79.858, -2.095],
    [-79.848, -2.155],
    [-79.852, -2.198],
    [-79.862, -2.238],
    [-79.878, -2.272],
    [-79.918, -2.278],
    [-79.952, -2.248],
    [-79.972, -2.198],
    [-79.968, -2.145],
    [-79.960, -2.088],
    [-79.942, -2.038],
  ],
];

export type ZonaGuayaquil = "Norte" | "Centro" | "Sur";

export type SectorGuayaquil = {
  slug: string;
  nombre: string;
  zona: ZonaGuayaquil;
  lat: number;
  lon: number;
  color: string;
};

/** Sectores de la cola Interagua (sur). */
export const SECTORES_COLA: SectorGuayaquil[] = [
  {
    slug: "las-malvinas",
    nombre: "Las Malvinas",
    zona: "Sur",
    lat: -2.2147,
    lon: -79.9053,
    color: "#0F766E",
  },
  {
    slug: "cristo-del-consuelo",
    nombre: "Cristo del Consuelo",
    zona: "Sur",
    lat: -2.2184,
    lon: -79.9182,
    color: "#1D4ED8",
  },
  {
    slug: "isla-trinitaria",
    nombre: "Isla Trinitaria",
    zona: "Sur",
    lat: -2.2258,
    lon: -79.9106,
    color: "#6D28D9",
  },
  {
    slug: "la-floresta",
    nombre: "La Floresta",
    zona: "Sur",
    lat: -2.2319,
    lon: -79.8881,
    color: "#B45309",
  },
  {
    slug: "fertisa",
    nombre: "Fertisa",
    zona: "Sur",
    lat: -2.2368,
    lon: -79.9004,
    color: "#C2410C",
  },
  {
    slug: "guasmo",
    nombre: "Guasmo",
    zona: "Sur",
    lat: -2.2465,
    lon: -79.8942,
    color: "#BE123C",
  },
];

/** Anclas extra para que el panal cubra norte y centro, no solo el sur. */
export const SECTORES_CIUDAD: SectorGuayaquil[] = [
  {
    slug: "pascuales",
    nombre: "Pascuales",
    zona: "Norte",
    lat: -2.067,
    lon: -79.936,
    color: "#0E7490",
  },
  {
    slug: "bastion-popular",
    nombre: "Bastión Popular",
    zona: "Norte",
    lat: -2.095,
    lon: -79.925,
    color: "#4338CA",
  },
  {
    slug: "alborada",
    nombre: "Alborada",
    zona: "Norte",
    lat: -2.139,
    lon: -79.894,
    color: "#047857",
  },
  {
    slug: "mapasingue",
    nombre: "Mapasingue",
    zona: "Centro",
    lat: -2.155,
    lon: -79.928,
    color: "#A16207",
  },
  {
    slug: "urdesa",
    nombre: "Urdesa",
    zona: "Centro",
    lat: -2.169,
    lon: -79.91,
    color: "#7C3AED",
  },
  {
    slug: "centenario",
    nombre: "Centenario",
    zona: "Centro",
    lat: -2.196,
    lon: -79.888,
    color: "#0369A1",
  },
];

export const SECTORES_GUAYAQUIL: SectorGuayaquil[] = [...SECTORES_COLA, ...SECTORES_CIUDAD];

export function colorDeSector(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return SECTORES_GUAYAQUIL.find((s) => s.slug === slug)?.color ?? null;
}
