"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MapaBrigadista } from "@/components/ruta/MapaBrigadista";
import {
  META_MINIZONAS_DIA,
  celdasEnOrden,
  distanciaM,
  etiquetaMinizona,
  largoRutaM,
  rutaDelDia,
} from "@/lib/geo/minizonas";
import type { Minizona } from "@/types";
import { cn } from "@/lib/utils";

type Asignada = { orden: number | null; estado: string; minizonas: Minizona | null };

/**
 * Jornada del brigadista: solo el cupo diario (8 minizonas), no el bloque entero.
 * El resto del tramo geográfico queda para otros días.
 */
export function MisMinizonas({ brigadistaId }: { brigadistaId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Asignada[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [viviendas, setViviendas] = useState<Record<string, number>>({});
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const lastTap = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("asignaciones_minizona")
        .select(
          "orden, estado, minizonas(id, sector_id, h3, lat, lon, estado, origen, foco_visita_id, meta_viviendas)"
        )
        .eq("brigadista_id", brigadistaId)
        .order("orden", { ascending: true });

      const lista = (data || []) as unknown as Asignada[];
      setItems(lista);

      const celdas = lista.map((i) => i.minizonas).filter(Boolean) as Minizona[];
      const sectorIds = Array.from(new Set(celdas.map((m) => m.sector_id)));
      const minizonaIds = celdas.map((m) => m.id);

      if (sectorIds.length) {
        const { data: secs } = await supabase
          .from("sectores")
          .select("id, nombre")
          .in("id", sectorIds);
        setNombres(Object.fromEntries((secs || []).map((s) => [s.id, s.nombre])));
      }

      if (minizonaIds.length) {
        const { data: visitas } = await supabase
          .from("visitas")
          .select("minizona_id")
          .eq("estado_visita", "inspeccionada")
          .in("minizona_id", minizonaIds);
        const counts: Record<string, number> = {};
        for (const v of visitas || []) {
          if (!v.minizona_id) continue;
          counts[v.minizona_id] = (counts[v.minizona_id] || 0) + 1;
        }
        setViviendas(counts);
      }

      setLoading(false);
    }
    load();
  }, [brigadistaId]);

  const onSeleccionarMapa = useCallback(
    (m: Minizona) => {
      setSeleccionadaId(m.id);
      cardRefs.current[m.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });

      const now = Date.now();
      if (lastTap.current?.id === m.id && now - lastTap.current.at < 900) {
        router.push(`/inspeccion/${m.sector_id}?minizona=${m.id}`);
        return;
      }
      lastTap.current = { id: m.id, at: now };
    },
    [router]
  );

  if (loading) {
    return (
      <div className="card animate-pulse space-y-2">
        <div className="h-4 w-40 rounded bg-ios-fill" />
        <div className="h-[240px] rounded-xl bg-ios-fill" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="card">
        <p className="font-heading font-bold text-ios-label">Sin minizonas asignadas</p>
        <p className="mt-1 text-sm text-ios-label-2">
          El jefe aún no te repartió celdas (~160 m). Cuando lo haga, aparecerán aquí con mapa.
        </p>
      </div>
    );
  }

  const bloque = celdasEnOrden(items);
  const hoy = rutaDelDia(bloque);
  const pendientes = bloque.filter((m) => m.estado !== "cubierta");
  const restoBloque = Math.max(0, pendientes.length - hoy.length);
  const hechasHoy = hoy.filter((m) => m.estado === "cubierta").length;
  const vivHoy = hoy.reduce((s, m) => s + (viviendas[m.id] || 0), 0);
  const metaHoy = hoy.reduce((s, m) => s + (m.meta_viviendas || 5), 0);
  const pct = metaHoy ? Math.round((100 * vivHoy) / metaHoy) : 0;
  const metros = largoRutaM(hoy);

  if (!hoy.length) {
    return (
      <div className="card">
        <p className="font-heading font-bold text-ios-label">Tramo cubierto</p>
        <p className="mt-1 text-sm text-ios-label-2">
          Las {bloque.length} minizonas de tu bloque ya están cubiertas. El jefe puede
          asignarte otro tramo del perímetro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ios-label-2">Hoy · minizonas del día</span>
          <span className="font-heading font-bold text-primary">
            {hechasHoy}/{META_MINIZONAS_DIA}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ios-fill">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs font-medium text-ios-label-2">
          Viviendas {vivHoy}/{metaHoy} en el tramo de hoy
        </p>
        <p className="text-xs leading-relaxed text-ios-label-3">
          Meta diaria: {META_MINIZONAS_DIA} minizonas (~40 viviendas).
          {restoBloque > 0
            ? ` El resto de tu bloque (${restoBloque}) queda para otros días para cubrir el perímetro sin cruzarte con la brigada.`
            : null}{" "}
          Ruta de {(metros / 1000).toFixed(1)} km · celdas de ~160 m. Tocá un hex para
          resaltar; otra vez para inspeccionar.
        </p>
        <MapaBrigadista
          minizonas={hoy}
          seleccionadaId={seleccionadaId}
          onSeleccionar={onSeleccionarMapa}
        />
      </div>

      <ul className="space-y-2">
        {hoy.map((m, i) => {
          const siguiente = i < hoy.length - 1 ? hoy[i + 1] : null;
          const aSiguiente = siguiente ? Math.round(distanciaM(m, siguiente)) : null;
          const cerco = m.origen === "cerco" && m.estado !== "cubierta";
          const nViv = viviendas[m.id] || 0;
          const meta = m.meta_viviendas || 5;
          const activa = seleccionadaId === m.id;

          return (
            <li
              key={m.id}
              ref={(el) => {
                cardRefs.current[m.id] = el;
              }}
            >
              <Link
                href={`/inspeccion/${m.sector_id}?minizona=${m.id}`}
                onClick={() => setSeleccionadaId(m.id)}
                className={cn(
                  "card block transition hover:ring-2 hover:ring-primary/30",
                  cerco && "ring-1 ring-risk-alto/40",
                  activa && "ring-2 ring-primary/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-bold",
                      m.estado === "cubierta"
                        ? "bg-risk-bajo-bg text-risk-bajo"
                        : cerco
                          ? "bg-risk-alto-bg text-risk-alto"
                          : "bg-ios-fill text-ios-label-2"
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-heading text-sm font-bold">{etiquetaMinizona(m.h3)}</p>
                      {cerco && (
                        <span className="rounded-full bg-risk-alto-bg px-2 py-0.5 text-[10px] font-bold text-risk-alto">
                          Cerco ~225 m
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ios-label-3">
                      {nombres[m.sector_id] || "Sector"}
                      {aSiguiente != null && ` · ${aSiguiente} m a la siguiente`}
                    </p>
                    <p className="mt-1 text-xs font-medium text-ios-label-2">
                      Viviendas {nViv}/{meta}
                      {m.estado === "cubierta" ? " · cubierta" : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      m.estado === "cubierta"
                        ? "bg-risk-bajo-bg text-risk-bajo"
                        : cerco
                          ? "bg-risk-alto-bg text-risk-alto"
                          : "bg-primary/10 text-primary"
                    )}
                  >
                    {m.estado === "cubierta" ? "Listo" : "Inspeccionar"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
