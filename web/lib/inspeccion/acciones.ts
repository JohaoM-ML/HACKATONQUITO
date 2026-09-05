import { ACCIONES_VISITA, type AccionVisita } from "@/types";

export function etiquetaAccion(value: AccionVisita): string {
  return ACCIONES_VISITA.find((a) => a.value === value)?.label ?? value;
}

export function toggleAccion(actual: AccionVisita[], value: AccionVisita): AccionVisita[] {
  return actual.includes(value) ? actual.filter((a) => a !== value) : [...actual, value];
}

/** Sugiere el checklist a partir del tratamiento ya marcado en recipientes. */
export function inferirAccionesDesdeRecipientes(
  recipientes: { tratado?: string | null }[]
): AccionVisita[] {
  const set = new Set<AccionVisita>();
  for (const r of recipientes) {
    if (r.tratado === "larvicida") set.add("larvicida");
    if (r.tratado === "eliminado" || r.tratado === "tapado") set.add("eliminar_tapar");
  }
  return ACCIONES_VISITA.map((a) => a.value).filter((v) => set.has(v));
}

export function mergeAcciones(base: AccionVisita[], extra: AccionVisita[]): AccionVisita[] {
  const set = new Set([...base, ...extra]);
  return ACCIONES_VISITA.map((a) => a.value).filter((v) => set.has(v));
}
