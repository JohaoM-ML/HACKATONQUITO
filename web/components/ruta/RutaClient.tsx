"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoError, EstadoVacio } from "@/components/estados/Estados";
import type { ColaItem } from "@/types";
import { cn } from "@/lib/utils";

type Filtro = "pendientes" | "todos" | "visitados";

export function RutaClient({ brigadistaId }: { brigadistaId: string }) {
  const [items, setItems] = useState<(ColaItem & { visitado?: boolean })[]>([]);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: cola, error: err } = await supabase
        .from("cola_items")
        .select("*, sectores(*)")
        .eq("regla", "A")
        .order("prioridad", { ascending: true });

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const sectorIds = (cola || []).map((c) => c.sector_id);
      const { data: visitas } = await supabase
        .from("visitas")
        .select("sector_id")
        .eq("brigadista_id", brigadistaId)
        .in("sector_id", sectorIds.length ? sectorIds : ["00000000-0000-0000-0000-000000000000"]);

      const visitados = new Set((visitas || []).map((v) => v.sector_id));
      setItems(
        (cola || []).map((c) => ({
          ...(c as ColaItem),
          visitado: visitados.has(c.sector_id),
        }))
      );
      setLoading(false);
    }
    load();
  }, [brigadistaId]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const nombre = it.sectores?.nombre || "";
      if (q && !nombre.toLowerCase().includes(q.toLowerCase())) return false;
      if (filtro === "pendientes") return !it.visitado;
      if (filtro === "visitados") return !!it.visitado;
      return true;
    });
  }, [items, q, filtro]);

  const nVisitados = items.filter((i) => i.visitado).length;
  const progreso = items.length ? Math.round((100 * nVisitados) / items.length) : 0;

  if (loading) return <EstadoCargando texto="Cargando cola Regla A…" />;
  if (error) return <EstadoError mensaje={error} />;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-ios-label-2">Progreso de ruta</span>
          <span className="font-heading font-bold text-primary">
            {nVisitados}/{items.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ios-fill">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progreso}%` }} />
        </div>
        <p className="mt-2 text-xs text-ios-label-3">Solo Regla A entra a la caminata</p>
      </div>

      <input
        className="input-field"
        placeholder="Buscar sector…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="flex gap-2">
        {(["pendientes", "todos", "visitados"] as Filtro[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={cn("chip flex-1 capitalize", filtro === f && "chip-active")}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EstadoVacio
          titulo="Sin sectores en cola"
          descripcion="No hay ítems Regla A. El jefe puede regenerar la cola desde cortes."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => (
            <li key={it.id}>
              <Link
                href={`/inspeccion/${it.sector_id}?cola=${it.id}`}
                className="card block transition hover:ring-2 hover:ring-primary/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading text-base font-bold text-ios-label">
                      {it.prioridad}. {it.sectores?.nombre || "Sector"}
                    </p>
                    <p className="text-xs text-ios-label-3">{it.sectores?.zona || "—"} · puntaje {it.puntaje}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      it.visitado ? "bg-green-100 text-ios-green" : "bg-red-100 text-ios-red"
                    )}
                  >
                    {it.visitado ? "Visitado" : "Regla A"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ios-label-2">{it.accion}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
