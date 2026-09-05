"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { contorno } from "@/lib/geo/minizonas";
import { FitBounds } from "@/components/mapa/FitBounds";
import type { Minizona } from "@/types";

/**
 * Colores por estado. Una minizona de cerco sin cubrir se pinta en rojo porque es la
 * que más urge: rodea un foco confirmado y el perímetro sigue abierto.
 */
function estiloEstado(m: Minizona) {
  if (m.origen === "cerco" && m.estado !== "cubierta") {
    return { fill: "#DC2626", opacity: 0.52 };
  }
  if (m.estado === "cubierta") return { fill: "#16A34A", opacity: 0.46 };
  if (m.estado === "en_curso") return { fill: "#CA8A04", opacity: 0.44 };
  return { fill: "#1E3A8A", opacity: 0.38 };
}

export function CapaMinizonas({
  minizonas,
  seleccionadaId,
  onSeleccionar,
  fitBounds = false,
  colorPorSectorId,
  modo = "estado",
}: {
  minizonas: Minizona[];
  /** Resalta el hex activo (stroke más grueso). */
  seleccionadaId?: string | null;
  onSeleccionar?: (m: Minizona) => void;
  /** Si true, ajusta el mapa a los centroides (útil si no hay FitBounds aparte). */
  fitBounds?: boolean;
  /** Color de relleno por sector (vista de ciudad). */
  colorPorSectorId?: Record<string, string>;
  modo?: "estado" | "sector";
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const poligonos = minizonas.map((m) => {
      const porSector =
        modo === "sector" ? colorPorSectorId?.[m.sector_id] : undefined;
      const base = estiloEstado(m);
      const fill =
        m.origen === "cerco" && m.estado !== "cubierta"
          ? base.fill
          : m.estado === "cubierta"
            ? base.fill
            : porSector || base.fill;
      const activa = seleccionadaId === m.id;
      const poly = new google.maps.Polygon({
        paths: contorno(m.h3),
        fillColor: fill,
        fillOpacity: activa ? Math.min(base.opacity + 0.18, 0.72) : base.opacity,
        strokeColor: activa ? "#0F172A" : "#FFFFFF",
        strokeWeight: activa ? 2.4 : 1.1,
        strokeOpacity: activa ? 0.95 : 0.8,
        geodesic: true,
        map,
        zIndex: activa ? 2 : 1,
      });
      if (onSeleccionar) poly.addListener("click", () => onSeleccionar(m));
      return poly;
    });

    return () => poligonos.forEach((p) => p.setMap(null));
  }, [map, minizonas, seleccionadaId, onSeleccionar, colorPorSectorId, modo]);

  return fitBounds ? <FitBounds minizonas={minizonas} /> : null;
}

export type VisitaPin = {
  id: string;
  sector_id?: string | null;
  lat: number;
  lon: number;
  estado_visita?: string;
};

/** Pines de visitas de campo (círculos). */
export function CapaVisitas({ visitas }: { visitas: VisitaPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const overlays = visitas.map((v) => {
      const foco = v.estado_visita === "inspeccionada" ? "#0EA5E9" : "#64748B";
      const circulo = new google.maps.Circle({
        center: { lat: v.lat, lng: v.lon },
        radius: 22,
        fillColor: foco,
        fillOpacity: 0.92,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        strokeOpacity: 1,
        map,
        zIndex: 20,
        clickable: false,
      });
      return circulo;
    });

    return () => overlays.forEach((c) => c.setMap(null));
  }, [map, visitas]);

  return null;
}

/** Círculo que muestra el radio elegido para el sector mientras el jefe lo delimita. */
export function CapaRadio({
  centro,
  radioM,
}: {
  centro: { lat: number; lng: number } | null;
  radioM: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !centro || typeof google === "undefined") return;
    const circulo = new google.maps.Circle({
      center: centro,
      radius: radioM,
      fillColor: "#1E3A8A",
      fillOpacity: 0.06,
      strokeColor: "#1E3A8A",
      strokeWeight: 1.5,
      strokeOpacity: 0.5,
      map,
    });
    const punto = new google.maps.Circle({
      center: centro,
      radius: 12,
      fillColor: "#1E3A8A",
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
      map,
    });
    map.panTo(centro);
    return () => {
      circulo.setMap(null);
      punto.setMap(null);
    };
  }, [map, centro, radioM]);

  return null;
}
