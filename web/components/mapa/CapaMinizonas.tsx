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
function estilo(m: Minizona) {
  if (m.origen === "cerco" && m.estado !== "cubierta") {
    return { fill: "#DC2626", stroke: "#991B1B", opacity: 0.55 };
  }
  if (m.estado === "cubierta") return { fill: "#16A34A", stroke: "#15803D", opacity: 0.48 };
  if (m.estado === "en_curso") return { fill: "#A16207", stroke: "#7C4A05", opacity: 0.42 };
  return { fill: "#1E3A8A", stroke: "#16296B", opacity: 0.32 };
}

export function CapaMinizonas({
  minizonas,
  seleccionadaId,
  onSeleccionar,
  fitBounds = false,
}: {
  minizonas: Minizona[];
  /** Resalta el hex activo (stroke más grueso). */
  seleccionadaId?: string | null;
  onSeleccionar?: (m: Minizona) => void;
  /** Si true, ajusta el mapa a los centroides (útil si no hay FitBounds aparte). */
  fitBounds?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const poligonos = minizonas.map((m) => {
      const { fill, stroke, opacity } = estilo(m);
      const activa = seleccionadaId === m.id;
      const poly = new google.maps.Polygon({
        paths: contorno(m.h3),
        fillColor: fill,
        fillOpacity: activa ? Math.min(opacity + 0.15, 0.7) : opacity,
        strokeColor: activa ? "#0F172A" : stroke,
        strokeWeight: activa ? 2.6 : 1.2,
        strokeOpacity: 0.9,
        map,
        zIndex: activa ? 2 : 1,
      });
      if (onSeleccionar) poly.addListener("click", () => onSeleccionar(m));
      return poly;
    });

    return () => poligonos.forEach((p) => p.setMap(null));
  }, [map, minizonas, seleccionadaId, onSeleccionar]);

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
