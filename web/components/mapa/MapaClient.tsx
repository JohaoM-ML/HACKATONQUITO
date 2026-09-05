"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  APILoadingStatus,
  APIProvider,
  Map,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoError } from "@/components/estados/Estados";
import { Card, CardHead, Pill, Progreso } from "@/components/panel/Tarjetas";
import {
  CapaMinizonas,
  CapaRadio,
  CapaVisitas,
  type VisitaPin,
} from "@/components/mapa/CapaMinizonas";
import { FitBounds } from "@/components/mapa/FitBounds";
import { etiquetaMinizona, RADIOS_SECTOR } from "@/lib/geo/minizonas";
import type { CoberturaSector, Minizona, Sector } from "@/types";
import { cn } from "@/lib/utils";

const CENTRO_GUAYAQUIL = { lat: -2.1894, lng: -79.8891 };

const MAPS_HELP =
  "Revisá en Google Cloud: 1) facturación activa, 2) Maps JavaScript API habilitada, 3) restricción de referrer HTTP que incluya http://localhost:3000/* (y tu dominio de deploy).";

function ErrorMapsUI({ detalle }: { detalle?: string | null }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 bg-ios-fill-2 px-6 text-center">
      <p className="font-heading text-base font-bold text-ios-label">
        No se pudo cargar Google Maps
      </p>
      <p className="max-w-md text-sm text-ios-label-2">{MAPS_HELP}</p>
      {detalle && (
        <p className="max-w-md rounded-lg bg-white/80 px-3 py-2 text-left text-[11px] text-ios-label-3">
          {detalle}
        </p>
      )}
    </div>
  );
}

/** Evita el blank blanco de AuthFailure / FAILED del loader de Maps. */
function MapaOError({
  children,
  defaultCenter,
  onMapClick,
  loadError,
}: {
  children: ReactNode;
  defaultCenter: { lat: number; lng: number };
  onMapClick: (latLng: { lat: number; lng: number } | null) => void;
  loadError: string | null;
}) {
  const status = useApiLoadingStatus();

  if (
    status === APILoadingStatus.AUTH_FAILURE ||
    status === APILoadingStatus.FAILED ||
    loadError
  ) {
    return (
      <ErrorMapsUI
        detalle={
          loadError ||
          (status === APILoadingStatus.AUTH_FAILURE
            ? "AuthFailure: la clave fue rechazada (billing, API o referrer)."
            : status === APILoadingStatus.FAILED
              ? "Falló la carga del script de Maps."
              : null)
        }
      />
    );
  }

  return (
    <Map
      defaultCenter={defaultCenter}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      onClick={(e) => onMapClick(e.detail.latLng ?? null)}
    >
      {children}
    </Map>
  );
}

export function MapaClient() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cobertura, setCobertura] = useState<CoberturaSector[]>([]);
  const [minizonas, setMinizonas] = useState<Minizona[]>([]);
  const [visitas, setVisitas] = useState<VisitaPin[]>([]);
  const [sectorSel, setSectorSel] = useState<string | null>(null);
  const [centro, setCentro] = useState<{ lat: number; lng: number } | null>(null);
  const [radio, setRadio] = useState<number>(500);
  const [detalle, setDetalle] = useState<Minizona | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    const supabase = createClient();
    const [sec, cob, min, vis] = await Promise.all([
      supabase.from("sectores").select("*").order("nombre"),
      supabase.from("cobertura_sector").select("*"),
      supabase
        .from("minizonas")
        .select("id, sector_id, h3, lat, lon, estado, origen, foco_visita_id, meta_viviendas"),
      supabase
        .from("visitas")
        .select("id, sector_id, lat, lon, estado_visita")
        .not("lat", "is", null)
        .not("lon", "is", null),
    ]);
    if (sec.error) setError(sec.error.message);
    setSectores((sec.data as Sector[]) || []);
    setCobertura((cob.data as CoberturaSector[]) || []);
    setMinizonas((min.data as Minizona[]) || []);
    const pins: VisitaPin[] = ((vis.data as VisitaPin[]) || []).filter(
      (v) => typeof v.lat === "number" && typeof v.lon === "number"
    );
    setVisitas(pins);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const sector = sectores.find((s) => s.id === sectorSel) ?? null;
  const cobSector = cobertura.find((c) => c.sector_id === sectorSel) ?? null;

  const visibles = useMemo(
    () => (sectorSel ? minizonas.filter((m) => m.sector_id === sectorSel) : minizonas),
    [minizonas, sectorSel]
  );

  const visitasVisibles = useMemo(
    () => (sectorSel ? visitas.filter((v) => v.sector_id === sectorSel) : visitas),
    [visitas, sectorSel]
  );

  const delimitar =
    !!sectorSel && (!cobSector || !Number(cobSector.minizonas_total));

  useEffect(() => {
    if (sector?.lat && sector?.lon) {
      setCentro({ lat: sector.lat, lng: sector.lon });
      if (sector.radio_m) setRadio(sector.radio_m);
    } else {
      setCentro(null);
    }
    setDetalle(null);
  }, [sector]);

  async function generarMalla() {
    if (!sectorSel || !centro) return;
    setTrabajando(true);
    setMsg(null);
    const res = await fetch("/api/minizonas/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sector_id: sectorSel,
        lat: centro.lat,
        lon: centro.lng,
        radio_m: radio,
      }),
    });
    const json = await res.json();
    setMsg(res.ok ? `Malla generada: ${json.generadas} minizonas de ~160 m.` : json.error);
    setTrabajando(false);
    await cargar();
  }

  async function repartir() {
    if (!sectorSel) return;
    setTrabajando(true);
    setMsg(null);
    const res = await fetch("/api/minizonas/asignar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector_id: sectorSel }),
    });
    const json = await res.json();
    setMsg(
      res.ok
        ? `${json.asignadas} minizonas repartidas entre ${json.brigadistas} brigadistas${
            json.cercos ? ` (${json.cercos} de cerco van primero)` : ""
          }.`
        : json.error
    );
    setTrabajando(false);
    await cargar();
  }

  if (loading) return <EstadoCargando />;
  if (error) return <EstadoError mensaje={error} />;

  const panelLateral = (
    <div className="space-y-4">
      <Card>
        <CardHead titulo="Sectores" />
        <div className="max-h-[280px] space-y-1 overflow-y-auto">
          {sectores.map((s) => {
            const c = cobertura.find((x) => x.sector_id === s.id);
            const activo = s.id === sectorSel;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSectorSel(activo ? null : s.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  activo ? "bg-primary/10" : "hover:bg-ios-fill-2"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{s.nombre}</p>
                  <p className="text-[11.5px] text-ios-label-2">
                    {c && Number(c.minizonas_total)
                      ? `${c.minizonas_cubiertas}/${c.minizonas_total} minizonas · ${c.pct_cobertura}%`
                      : "Sin delimitar"}
                  </p>
                </div>
                {c && Number(c.minizonas_cerco) > 0 && (
                  <Pill tono="alto">{c.minizonas_cerco} cerco</Pill>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {sector && (
        <Card>
          <CardHead titulo={sector.nombre} />
          {!cobSector || !Number(cobSector.minizonas_total) ? (
            <div className="space-y-3">
              <p className="text-sm text-ios-label-2">
                Este sector no tiene malla. Haz clic en el mapa para marcar el centro y elige
                hasta dónde llega el barrio.
              </p>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ios-label-2">
                  Radio
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {RADIOS_SECTOR.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadio(r)}
                      className={cn(
                        "rounded-lg border-2 py-2 text-xs font-semibold transition",
                        radio === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-ios-sep text-ios-label-2"
                      )}
                    >
                      {r} m
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-ios-label-3">
                {centro
                  ? `Centro en ${centro.lat.toFixed(5)}, ${centro.lng.toFixed(5)}`
                  : "Sin centro marcado"}
              </p>
              <button
                type="button"
                disabled={!centro || trabajando}
                onClick={generarMalla}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {trabajando ? "Generando…" : "Generar malla de minizonas"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-ios-label-2">Cobertura</span>
                  <span className="font-heading text-sm font-bold">{cobSector.pct_cobertura}%</span>
                </div>
                <Progreso pct={Number(cobSector.pct_cobertura) || 0} />
                <p className="mt-1 text-[11px] text-ios-label-2">
                  {cobSector.minizonas_cubiertas} cubiertas · {cobSector.minizonas_en_curso} en curso ·{" "}
                  {Number(cobSector.minizonas_total) -
                    Number(cobSector.minizonas_cubiertas) -
                    Number(cobSector.minizonas_en_curso)}{" "}
                  pendientes
                </p>
              </div>

              {Number(cobSector.minizonas_cerco) > 0 && (
                <div className="rounded-xl bg-risk-alto-bg p-3">
                  <p className="text-xs font-semibold text-risk-alto">
                    Cercos perifocales: {cobSector.cercos_cerrados}/{cobSector.minizonas_cerco}{" "}
                    cerrados
                  </p>
                  <p className="mt-0.5 text-[11px] text-ios-label-2">
                    Minizonas abiertas alrededor de un foco confirmado, dentro del radio de ~225 m
                    en que se dispersa el vector.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={trabajando}
                onClick={repartir}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {trabajando ? "Repartiendo…" : "Repartir entre brigadistas"}
              </button>
              <p className="text-[11px] text-ios-label-3">
                El reparto es geográfico: cada brigadista recibe un bloque contiguo, ordenado por
                vecino más cercano.
              </p>
            </div>
          )}
        </Card>
      )}

      {detalle && (
        <Card>
          <CardHead titulo={etiquetaMinizona(detalle.h3)} />
          <p className="text-sm text-ios-label-2">
            Estado: <b className="text-ios-label">{detalle.estado}</b> ·{" "}
            {detalle.origen === "cerco" ? "abierta por un foco vecino" : "parte de la malla"}
          </p>
          <p className="mt-1 text-xs text-ios-label-3">
            Meta: {detalle.meta_viviendas} viviendas inspeccionadas · {detalle.lat.toFixed(5)},{" "}
            {detalle.lon.toFixed(5)}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 px-1 text-[11px] text-ios-label-2">
        {[
          ["#1E3A8A", "Pendiente"],
          ["#A16207", "En curso"],
          ["#16A34A", "Cubierta"],
          ["#DC2626", "Cerco abierto"],
          ["#0EA5E9", "Visita"],
        ].map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {msg && <p className="px-1 text-xs font-medium text-primary">{msg}</p>}
    </div>
  );

  if (!apiKey) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <p className="font-heading font-bold">Falta la clave de Google Maps</p>
          <p className="mt-1 max-w-sm text-sm text-ios-label-2">
            Definí <code className="rounded bg-ios-fill px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
            en <code className="rounded bg-ios-fill px-1">.env.local</code> para ver el mapa real.
            Todo lo demás del panel funciona sin ella.
          </p>
          <p className="mt-3 max-w-sm text-xs text-ios-label-3">{MAPS_HELP}</p>
        </Card>
        {panelLateral}
      </div>
    );
  }

  const mapDefaultCenter = centro ?? CENTRO_GUAYAQUIL;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card className="overflow-hidden p-2">
        <div className="h-[520px] w-full overflow-hidden rounded-xl">
          <APIProvider
            apiKey={apiKey}
            onError={(err) => {
              const text =
                err instanceof Error
                  ? err.message
                  : typeof err === "string"
                    ? err
                    : "Error al cargar el script de Google Maps.";
              setMapsError(text);
            }}
          >
            <MapaOError
              defaultCenter={mapDefaultCenter}
              loadError={mapsError}
              onMapClick={(latLng) => {
                if (!sectorSel || !latLng) return;
                if (cobSector && Number(cobSector.minizonas_total) > 0) return;
                setCentro(latLng);
              }}
            >
              {visibles.length > 0 ? (
                <FitBounds minizonas={visibles} padding={56} />
              ) : centro && !delimitar ? (
                <FitBounds puntos={[{ lat: centro.lat, lng: centro.lng }]} />
              ) : null}
              <CapaMinizonas
                minizonas={visibles}
                onSeleccionar={setDetalle}
                seleccionadaId={detalle?.id}
              />
              <CapaVisitas visitas={visitasVisibles} />
              <CapaRadio centro={delimitar ? centro : null} radioM={radio} />
            </MapaOError>
          </APIProvider>
        </div>
      </Card>
      {panelLateral}
    </div>
  );
}
