"use client";

import { useCallback, useEffect, useRef } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { FitBounds } from "@/components/mapa/FitBounds";
import type { Minizona } from "@/types";

const CENTRO_GUAYAQUIL = { lat: -2.1894, lng: -79.8891 };
const COLOR_RUTA = "#1E40AF";

function colorParada(m: Minizona) {
  if (m.estado === "cubierta") return "#16A34A";
  if (m.origen === "cerco") return "#DC2626";
  if (m.estado === "en_curso") return "#CA8A04";
  return "#1E40AF";
}

/**
 * Paradas numeradas en vez del hexágono completo: no tenemos la ubicación real
 * de cada vivienda (no hay catastro/direcciones cargadas), así que dibujar el
 * polígono del hexágono era mostrar una forma que no corresponde a nada que el
 * brigadista vea en la calle. Un pin numerado en el centro de la celda, sobre
 * la ruta real, es más honesto: "para acá" en vez de "esta figura geométrica".
 */
function CapaParadas({
  minizonas,
  seleccionadaId,
  onSeleccionar,
}: {
  minizonas: Minizona[];
  seleccionadaId?: string | null;
  onSeleccionar?: (m: Minizona) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const marcadores = minizonas.map((m, i) => {
      const activa = seleccionadaId === m.id;
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lon },
        map,
        label: { text: String(i + 1), color: "#fff", fontSize: "12px", fontWeight: "700" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: colorParada(m),
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: activa ? 3 : 2,
          scale: activa ? 15 : 12,
        },
        zIndex: activa ? 10 : 5,
      });
      if (onSeleccionar) marker.addListener("click", () => onSeleccionar(m));
      return marker;
    });

    return () => marcadores.forEach((m) => m.setMap(null));
  }, [map, minizonas, seleccionadaId, onSeleccionar]);

  return null;
}

/**
 * Polilínea del tramo de hoy, siguiendo veredas/calles reales (Directions API,
 * modo caminando) en vez de una línea recta entre centroides de hexágono —
 * esa línea recta cruzaba manzanas enteras y se veía como un trazo inventado.
 * Si el ruteo falla, no se dibuja nada: las paradas numeradas (CapaParadas) ya
 * dejan claro el orden sin necesidad de una línea de respaldo.
 */
function CapaRutaDelDia({
  minizonas,
  onDistancia,
}: {
  minizonas: Minizona[];
  onDistancia?: (metros: number | null) => void;
}) {
  const map = useMap();
  const onDistanciaRef = useRef(onDistancia);
  onDistanciaRef.current = onDistancia;

  useEffect(() => {
    if (!map || typeof google === "undefined" || minizonas.length < 2) return;

    let cancelado = false;
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: COLOR_RUTA,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        zIndex: 4,
      },
    });

    const puntos = minizonas.map((m) => ({ lat: m.lat, lng: m.lon }));

    new google.maps.DirectionsService().route(
      {
        origin: puntos[0],
        destination: puntos[puntos.length - 1],
        waypoints: puntos.slice(1, -1).map((location) => ({ location, stopover: true })),
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.WALKING,
      },
      (resultado, status) => {
        if (cancelado) return;
        if (status !== google.maps.DirectionsStatus.OK || !resultado) {
          // Sin línea de respaldo: las paradas numeradas ya dejan claro el orden.
          onDistanciaRef.current?.(null);
          return;
        }
        renderer.setDirections(resultado);
        const metros = resultado.routes[0]?.legs.reduce((s, leg) => s + (leg.distance?.value || 0), 0) ?? null;
        onDistanciaRef.current?.(metros);
      }
    );

    return () => {
      cancelado = true;
      renderer.setMap(null);
    };
  }, [map, minizonas]);

  return null;
}

/**
 * Mapa compacto (móvil ~240px) solo con las paradas del día.
 * Click en un pin → resalta / navega vía callback del padre.
 */
export function MapaBrigadista({
  minizonas,
  seleccionadaId,
  onSeleccionar,
  onDistanciaRuta,
}: {
  minizonas: Minizona[];
  seleccionadaId?: string | null;
  onSeleccionar?: (m: Minizona) => void;
  /** Distancia real de caminata (m) una vez que Directions responde; null si no se pudo rutear. */
  onDistanciaRuta?: (metros: number | null) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const handleSel = useCallback(
    (m: Minizona) => onSeleccionar?.(m),
    [onSeleccionar]
  );

  if (!minizonas.length) return null;

  if (!apiKey) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg bg-muted px-4 text-center text-xs text-muted-fg">
        Definí NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver el mapa de tus celdas.
      </div>
    );
  }

  const centro = {
    lat: minizonas[0].lat,
    lng: minizonas[0].lon,
  };

  return (
    <div className="h-[320px] w-full overflow-hidden rounded-lg ring-1 ring-border">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={centro ?? CENTRO_GUAYAQUIL}
          defaultZoom={16}
          gestureHandling="greedy"
          disableDefaultUI
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          zoomControl
          style={{ width: "100%", height: "100%" }}
        >
          <FitBounds minizonas={minizonas} padding={40} />
          <CapaRutaDelDia minizonas={minizonas} onDistancia={onDistanciaRuta} />
          <CapaParadas minizonas={minizonas} seleccionadaId={seleccionadaId} onSeleccionar={handleSel} />
        </Map>
      </APIProvider>
    </div>
  );
}
