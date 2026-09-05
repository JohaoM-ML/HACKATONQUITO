"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import { Card, CardHead } from "@/components/panel/Tarjetas";
import type { ColaItem } from "@/types";

function haceCuanto(iso: string | undefined) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function AvisosClient() {
  const [items, setItems] = useState<ColaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from("cola_items")
      .select("*, sectores(*), cortes(fecha_inicio, duracion_horas)")
      .eq("regla", "A")
      .order("prioridad", { ascending: true })
      .then(({ data }) => {
        setItems((data as ColaItem[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <EstadoCargando />;
  if (!items.length) {
    return <EstadoVacio titulo="Sin avisos" descripcion="No hay zonas riesgosas activas." />;
  }

  return (
    <Card>
      <CardHead titulo="Cortes que generan una zona riesgosa" />
      <div>
        {items.map((it) => {
          const nombre = it.sectores?.nombre || "sector";
          const corte = (
            it as ColaItem & {
              cortes?: { fecha_inicio?: string; duracion_horas?: string | null } | null;
            }
          ).cortes;
          const msg = encodeURIComponent(
            `Hola, soy de la brigada antidengue. Hoy priorizamos ${nombre}: ${it.accion || "inspección de recipientes"}. ${it.justificacion || ""}`.slice(
              0,
              500
            )
          );
          return (
            <div
              key={it.id}
              className="flex items-start gap-2.5 border-b border-ios-sep py-3 last:border-0 last:pb-0 first:pt-0"
            >
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-risk-alto" />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[13px] font-semibold">{nombre}</b>
                <span className="text-[11.5px] text-ios-label-2">
                  Corte reportado
                  {corte?.duracion_horas ? ` · ${corte.duracion_horas}` : ""}
                </span>
                <p className="mt-1 line-clamp-2 text-[11.5px] text-ios-label-2">
                  {it.justificacion}
                </p>
                <div className="mt-2 flex gap-2">
                  <a
                    className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white"
                    href={`https://wa.me/?text=${msg}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    className="rounded-lg bg-ios-fill px-3 py-1.5 text-[12px] font-semibold text-ios-label"
                    onClick={() => navigator.clipboard.writeText(decodeURIComponent(msg))}
                  >
                    Copiar
                  </button>
                </div>
              </div>
              <span className="shrink-0 whitespace-nowrap text-[11px] text-ios-label-3">
                {haceCuanto(corte?.fecha_inicio || it.fecha_eval)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
