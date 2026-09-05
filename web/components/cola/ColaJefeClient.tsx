"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import { Avatar, Card, Pill } from "@/components/panel/Tarjetas";
import type { ColaItem } from "@/types";
import { cn } from "@/lib/utils";

type Filtro = "A" | "B" | "todas";

function inicial(n: string) {
  return n.trim().charAt(0).toUpperCase();
}

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
    return (
      <EstadoVacio titulo="Cola vacía" descripcion="Ejecuta el seed de cortes para generar ítems." />
    );
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

      <Card>
        {filtered.map((it) => {
          const nombre = it.sectores?.nombre || "Sector";
          return (
            <div
              key={it.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 border-b border-ios-sep py-3 last:border-0 last:pb-0 first:pt-0"
            >
              <Avatar
                texto={inicial(nombre)}
                tono={it.regla === "A" ? "alto" : "medio"}
              />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">
                  {it.prioridad}. {nombre}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] text-ios-label-2">
                  {it.justificacion}
                </p>
                {it.hipotesis && (
                  <p className="mt-1 text-[11px] font-semibold text-risk-medio">
                    Hipótesis — no entra a la ruta de caminata
                  </p>
                )}
              </div>
              <Pill tono={it.regla === "A" ? "alto" : "medio"}>
                {it.label_regla || `Regla ${it.regla}`}
              </Pill>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
