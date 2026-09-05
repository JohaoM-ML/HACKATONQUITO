"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import { Avatar, Card, Pill, Progreso } from "@/components/panel/Tarjetas";
import { celdasEnOrden, etiquetaMinizona, rutaDelDia } from "@/lib/geo/minizonas";
import type { Minizona, Perfil } from "@/types";

type Asignada = { orden: number | null; estado: string; minizonas: Minizona | null };
type Row = Perfil & {
  visitas: number;
  visitasHoy: number;
  minizonas: Asignada[];
};

function iniciales(n: string) {
  return n.trim().charAt(0).toUpperCase();
}

export function EquipoClient({ brigadaId }: { brigadaId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      let q = supabase.from("perfiles").select("*").eq("rol", "brigadista");
      if (brigadaId) q = q.eq("brigada_id", brigadaId);

      const { data: perfiles } = await q;
      const lista = (perfiles as Perfil[]) || [];
      const ids = lista.map((p) => p.id);

      if (!ids.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);

      const [visitas, asignaciones] = await Promise.all([
        supabase.from("visitas").select("brigadista_id, fecha_hora").in("brigadista_id", ids),
        supabase
          .from("asignaciones_minizona")
          .select(
            "brigadista_id, orden, estado, minizonas(id, sector_id, h3, lat, lon, estado, origen, foco_visita_id, meta_viviendas)"
          )
          .in("brigadista_id", ids)
          .order("orden", { ascending: true }),
      ]);

      const v = visitas.data || [];
      const a = (asignaciones.data || []) as unknown as (Asignada & { brigadista_id: string })[];

      setRows(
        lista.map((p) => ({
          ...p,
          visitas: v.filter((x) => x.brigadista_id === p.id).length,
          visitasHoy: v.filter(
            (x) => x.brigadista_id === p.id && new Date(x.fecha_hora) >= inicioHoy
          ).length,
          minizonas: a.filter((x) => x.brigadista_id === p.id),
        }))
      );
      setLoading(false);
    }
    load();
  }, [brigadaId]);

  if (loading) return <EstadoCargando />;
  if (!rows.length) {
    return (
      <EstadoVacio
        titulo="Sin brigadistas"
        descripcion="Pedí a tu equipo que se registre con el rol brigadista y tu brigada."
      />
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const bloque = celdasEnOrden(
          r.minizonas.map((a) => ({ orden: a.orden, minizonas: a.minizonas }))
        );
        const cubiertas = bloque.filter((m) => m.estado === "cubierta").length;
        const hoy = rutaDelDia(bloque).length;
        const pct = bloque.length ? (cubiertas / bloque.length) * 100 : 0;
        return (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-3.5">
              <Avatar texto={iniciales(r.nombre)} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">{r.nombre}</p>
                <p className="text-[11.5px] text-muted-fg">
                  {r.telefono || "sin teléfono"} · {r.visitas} viviendas en total
                </p>
              </div>
              <div className="w-40">
                <Progreso pct={pct} />
                <p className="mt-1 text-[11px] text-muted-fg">
                  {hoy} hoy · {cubiertas}/{bloque.length} en su bloque
                </p>
              </div>
              <Pill tono={r.visitasHoy > 0 ? "on" : "off"}>
                {r.visitasHoy > 0 ? `${r.visitasHoy} hoy` : "Sin registros hoy"}
              </Pill>
            </div>

            {bloque.length > 0 && (
              <div className="mt-3.5 border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-fg">
                  Ruta de hoy
                  {bloque.length > hoy
                    ? ` · ${bloque.length - cubiertas - hoy} más en su bloque`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rutaDelDia(bloque).map((m, i) => (
                    <span
                      key={m.id}
                      className={
                        "rounded-lg px-2 py-1 text-[11px] font-bold " +
                        (m.origen === "cerco"
                          ? "bg-risk-alto-bg text-risk-alto"
                          : "bg-muted text-muted-fg")
                      }
                      title={m.origen === "cerco" ? "Cerco de un foco" : "Malla del sector"}
                    >
                      {i + 1}. {etiquetaMinizona(m.h3)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
