"use client";

import {
  Check,
  Droplets,
  GraduationCap,
  Grid3x3,
  Package,
  Trash2,
} from "lucide-react";
import { ACCIONES_VISITA, type AccionVisita } from "@/types";
import { toggleAccion } from "@/lib/inspeccion/acciones";
import { cn } from "@/lib/utils";

const ICONS: Record<AccionVisita, typeof Trash2> = {
  eliminar_tapar: Trash2,
  larvicida: Droplets,
  malla: Grid3x3,
  entrenar_hogar: GraduationCap,
  entregar_material: Package,
};

type Props = {
  value: AccionVisita[];
  onChange: (next: AccionVisita[]) => void;
  sugeridas?: AccionVisita[];
};

export function AccionesChecklist({ value, onChange, sugeridas = [] }: Props) {
  const n = value.length;

  return (
    <fieldset className="space-y-3">
      <legend className="font-heading text-lg font-bold text-fg">
        Acciones en este hogar
      </legend>
      <p id="acciones-hint" className="text-sm leading-relaxed text-muted-fg">
        Marcá solo lo que ya ejecutaste. Más adelante se compara, en
        reinspecciones, qué paquete deja la zona más tiempo sin criaderos.
      </p>
      <p className="text-xs font-bold text-primary" aria-live="polite">
        {n === 0
          ? "Ninguna acción marcada todavía"
          : `${n} de ${ACCIONES_VISITA.length} acciones marcadas`}
      </p>

      <div className="space-y-2" role="group" aria-describedby="acciones-hint">
        {ACCIONES_VISITA.map((a) => {
          const checked = value.includes(a.value);
          const Icon = ICONS[a.value];
          const sugerida = !checked && sugeridas.includes(a.value);
          return (
            <button
              key={a.value}
              type="button"
              aria-pressed={checked}
              onClick={() => onChange(toggleAccion(value, a.value))}
              className={cn(
                "flex min-h-tap w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                checked
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border",
                  checked
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card text-transparent"
                )}
              >
                <Check size={16} strokeWidth={3} />
              </span>
              <Icon
                size={22}
                strokeWidth={2.1}
                aria-hidden
                className={cn("mt-0.5 shrink-0", checked ? "text-primary" : "text-muted-fg")}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-bold",
                    checked ? "text-primary" : "text-fg"
                  )}
                >
                  {a.label}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-fg">
                  {a.detalle}
                </span>
                {sugerida && (
                  <span className="mt-1 block text-[11px] font-bold text-accent">
                    Sugerido por el tratamiento del recipiente
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
