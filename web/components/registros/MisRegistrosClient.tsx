"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import { etiquetaMinizona } from "@/lib/geo/minizonas";
import { ACCIONES_VISITA, type AccionVisita, type Visita } from "@/types";

type VisitaRow = Visita & {
  sectores?: { nombre: string } | null;
  minizonas?: { id: string; h3: string; origen: string } | null;
};

type Grupo = {
  key: string;
  titulo: string;
  subtitulo: string;
  visitas: VisitaRow[];
};

/**
 * Registros del brigadista agrupados por minizona cuando hay vínculo;
 * las visitas sin minizona caen en "Sin minizona".
 */
export function MisRegistrosClient({ brigadistaId }: { brigadistaId: string }) {
  const [visitas, setVisitas] = useState<VisitaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from("visitas")
      .select("*, sectores(nombre), minizonas(id, h3, origen)")
      .eq("brigadista_id", brigadistaId)
      .order("fecha_hora", { ascending: false })
      .then(({ data }) => {
        setVisitas((data as VisitaRow[]) || []);
        setLoading(false);
      });
  }, [brigadistaId]);

  const grupos = useMemo(() => {
    const map = new Map<string, Grupo>();
    for (const v of visitas) {
      const mz = v.minizonas;
      const key = mz?.id || (v.h3 ? `h3:${v.h3}` : "sin");
      if (!map.has(key)) {
        const titulo = mz
          ? etiquetaMinizona(mz.h3)
          : v.h3
            ? etiquetaMinizona(v.h3)
            : "Sin minizona";
        const subtitulo = mz
          ? `${v.sectores?.nombre || "Sector"}${mz.origen === "cerco" ? " · cerco" : ""}`
          : v.sectores?.nombre || "Sector";
        map.set(key, { key, titulo, subtitulo, visitas: [] });
      }
      map.get(key)!.visitas.push(v);
    }
    return Array.from(map.values());
  }, [visitas]);

  if (loading) return <EstadoCargando />;
  if (!visitas.length) {
    return (
      <EstadoVacio titulo="Sin registros" descripcion="Las visitas que guardes aparecerán aquí." />
    );
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.key} className="space-y-2">
          <div className="px-1">
            <p className="font-heading text-sm font-bold text-fg">{g.titulo}</p>
            <p className="text-[11px] text-muted-fg">
              {g.subtitulo} · {g.visitas.length} visita{g.visitas.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="space-y-2">
            {g.visitas.map((v) => (
              <li key={v.id} className="card">
                <div className="flex justify-between gap-2">
                  <p className="font-heading text-sm font-bold text-fg">
                    {v.codigo_vivienda || "sin código"}
                  </p>
                  <span className="text-[11px] font-bold capitalize text-muted-fg">
                    {v.estado_visita}
                  </span>
                </div>
                <p className="text-xs text-muted-fg">
                  {new Date(v.fecha_hora).toLocaleString("es-EC")}
                </p>
                {v.acciones?.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {ACCIONES_VISITA.filter((a) =>
                      (v.acciones as AccionVisita[]).includes(a.value)
                    ).map((a) => (
                      <li
                        key={a.value}
                        className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
                      >
                        {a.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-fg">Sin acciones marcadas</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
