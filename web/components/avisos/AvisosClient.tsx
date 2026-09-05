"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import type { ColaItem } from "@/types";

export function AvisosClient() {
  const [items, setItems] = useState<ColaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from("cola_items")
      .select("*, sectores(*)")
      .eq("regla", "A")
      .order("prioridad", { ascending: true })
      .then(({ data }) => {
        setItems((data as ColaItem[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <EstadoCargando />;
  if (!items.length) return <EstadoVacio titulo="Sin avisos" descripcion="No hay barrios Regla A." />;

  return (
    <ul className="space-y-3">
      {items.map((it) => {
        const nombre = it.sectores?.nombre || "sector";
        const msg = encodeURIComponent(
          `Hola, soy de la brigada antidengue. Hoy priorizamos ${nombre}: ${it.accion || "inspección de recipientes"}. ${it.justificacion || ""}`.slice(
            0,
            500
          )
        );
        return (
          <li key={it.id} className="card space-y-2">
            <p className="font-heading font-bold">{nombre}</p>
            <p className="text-xs text-ios-label-2 line-clamp-3">{it.justificacion}</p>
            <div className="flex gap-2">
              <a
                className="btn-primary flex-1 text-center text-sm"
                href={`https://wa.me/?text=${msg}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <button
                type="button"
                className="btn-secondary flex-1 text-sm"
                onClick={() => navigator.clipboard.writeText(decodeURIComponent(msg))}
              >
                Copiar
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
