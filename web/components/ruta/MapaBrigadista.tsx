"use client";

import { useCallback, useEffect } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { CapaMinizonas } from "@/components/mapa/CapaMinizonas";
import type { Minizona } from "@/types";

const CENTRO_GUAYAQUIL = { lat: -2.1894, lng: -79.8891 };
const COLOR_RUTA = "#1E3A8A";

/** Polilínea que une el tramo de hoy en orden de caminata. */
function CapaRutaDelDia({ minizonas }: { minizonas: Minizona[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined" || minizonas.length < 2) return;

    const line = new google.maps.Polyline({
      path: minizonas.map((m) => ({ lat: m.lat, lng: m.lon })),
      strokeColor: COLOR_RUTA,
      strokeOpacity: 0.92,
      strokeWeight: 3.5,
      geodesic: true,
      map,
      zIndex: 4,
      clickable: false,
    });

    return () => line.setMap(null);
  }, [map, minizonas]);

  return null;
}

/**
 * Mapa compacto (móvil ~240px) solo con las minizonas del día.
 * Click en un hex → resalta / navega vía callback del padre.
 */
export function MapaBrigadista({
  minizonas,
  seleccionadaId,
  onSeleccionar,
}: {
  minizonas: Minizona[];
  seleccionadaId?: string | null;
  onSeleccionar?: (m: Minizona) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const handleSel = useCallback(
    (m: Minizona) => onSeleccionar?.(m),
    [onSeleccionar]
  );

  if (!minizonas.length) return null;

  if (!apiKey) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl bg-ios-fill px-4 text-center text-xs text-ios-label-3">
        Definí NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver el mapa de tus celdas.
      </div>
    );
  }

  const centro = {
    lat: minizonas[0].lat,
    lng: minizonas[0].lon,
  };

  return (
    <div className="h-[240px] w-full overflow-hidden rounded-xl ring-1 ring-ios-sep">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={centro ?? CENTRO_GUAYAQUIL}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          zoomControl
          style={{ width: "100%", height: "100%" }}
        >
          <CapaMinizonas
            minizonas={minizonas}
            seleccionadaId={seleccionadaId}
            onSeleccionar={handleSel}
            fitBounds
          />
          <CapaRutaDelDia minizonas={minizonas} />
        </Map>
      </APIProvider>
    </div>
  );
}
