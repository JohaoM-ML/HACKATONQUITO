"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import type { ColaItem } from "@/types";
import { cn } from "@/lib/utils";

type Filtro = "A" | "B" | "todas";

export function ColaJefeClient() {
  const [items, setItems] = useState<ColaItem[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from("cola_items")
      .select("*, sectores(*)")
      .order("prioridad", { ascending: true })
      .then(({ data }) => {
        setItems((data as ColaItem[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (filtro === "todas") return items;
    return items.filter((i) => i.regla === filtro);
  }, [items, filtro]);

  if (loading) return <EstadoCargando />;
  if (!items.length) {
    return <EstadoVacio titulo="Cola vacía" descripcion="Ejecuta el seed de cortes para generar ítems." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["A", "B", "todas"] as Filtro[]).map((f) => (
          <button
            key={f}
            type="button"
            className={cn("chip flex-1", filtro === f && "chip-active")}
            onClick={() => setFiltro(f)}
          >
            {f === "todas" ? "Todas" : `Regla ${f}`}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {filtered.map((it) => (
          <li key={it.id} className="card">
            <div className="flex justify-between gap-2">
              <p className="font-heading font-bold">
                {it.prioridad}. {it.sectores?.nombre}
              </p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  it.regla === "A" ? "bg-red-100 text-ios-red" : "bg-orange-100 text-ios-orange"
                )}
              >
                {it.label_regla || it.regla}
              </span>
            </div>
            <p className="mt-1 text-xs text-ios-label-2">{it.justificacion}</p>
            {it.hipotesis && (
              <p className="mt-1 text-[11px] font-semibold text-ios-orange">
                Hipótesis — no entra a ruta de caminata
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
