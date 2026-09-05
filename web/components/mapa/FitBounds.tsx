"use client";

import { useEffect, useMemo } from "react";
import { useMap } from "@vis.gl/react-google-maps";

type Punto = { lat: number; lon?: number; lng?: number };

/**
 * Ajusta el viewport a centroides visibles (minizonas o puntos sueltos).
 * Acepta `minizonas` (API brigadista) o `puntos`.
 */
export function FitBounds({
  puntos,
  minizonas,
  padding = 56,
  maxZoom = 16,
}: {
  puntos?: Punto[];
  minizonas?: Punto[];
  padding?: number;
  maxZoom?: number;
}) {
  const map = useMap();
  const lista = useMemo(() => puntos ?? minizonas ?? [], [puntos, minizonas]);

  useEffect(() => {
    if (!map || !lista.length || typeof google === "undefined") return;

    const bounds = new google.maps.LatLngBounds();
    let n = 0;
    for (const p of lista) {
      const lng = p.lng ?? p.lon;
      if (p.lat == null || lng == null || Number.isNaN(p.lat) || Number.isNaN(lng)) continue;
      bounds.extend({ lat: p.lat, lng });
      n += 1;
    }
    if (!n || bounds.isEmpty()) return;

    map.fitBounds(bounds, padding);

    const listener = google.maps.event.addListenerOnce(map, "idle", () => {
      const z = map.getZoom();
      if (z != null && z > maxZoom) map.setZoom(maxZoom);
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, lista, padding, maxZoom]);

  return null;
}
