"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import type { Visita } from "@/types";

export function MisRegistrosClient({ brigadistaId }: { brigadistaId: string }) {
  const [visitas, setVisitas] = useState<(Visita & { sectores?: { nombre: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from("visitas")
      .select("*, sectores(nombre)")
      .eq("brigadista_id", brigadistaId)
      .order("fecha_hora", { ascending: false })
      .then(({ data }) => {
        setVisitas((data as typeof visitas) || []);
        setLoading(false);
      });
  }, [brigadistaId]);

  if (loading) return <EstadoCargando />;
  if (!visitas.length) {
    return <EstadoVacio titulo="Sin registros" descripcion="Las visitas que guardes aparecerán aquí." />;
  }

  return (
    <ul className="space-y-2">
      {visitas.map((v) => (
        <li key={v.id} className="card">
          <div className="flex justify-between">
            <p className="font-heading font-bold">{v.sectores?.nombre || "Sector"}</p>
            <span className="text-[11px] font-semibold capitalize text-ios-label-3">{v.estado_visita}</span>
          </div>
          <p className="text-xs text-ios-label-2">
            {new Date(v.fecha_hora).toLocaleString("es-EC")} · {v.codigo_vivienda || "sin código"}
          </p>
        </li>
      ))}
    </ul>
  );
}
