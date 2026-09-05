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
  CapaSectorRiesgo,
  CapaVisitas,
  type SectorPrioridad,
  type VisitaPin,
} from "@/components/mapa/CapaMinizonas";
import { FitBounds } from "@/components/mapa/FitBounds";
import { etiquetaMinizona, radioAutomatico } from "@/lib/geo/minizonas";
import { etiquetaZona } from "@/lib/motor/reglas";
import type { ColaItem, CoberturaSector, Minizona, Sector } from "@/types";
import { cn } from "@/lib/utils";

const CENTRO_GUAYAQUIL = { lat: -2.1894, lng: -79.8891 };

const MAPS_HELP =
  "Revisá en Google Cloud: 1) facturación activa, 2) Maps JavaScript API habilitada, 3) restricción de referrer HTTP que incluya http://localhost:3000/* (y tu dominio de deploy).";

function ErrorMapsUI({ detalle }: { detalle?: string | null }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 bg-muted px-6 text-center">
      <p className="font-heading text-base font-bold text-fg">
        No se pudo cargar Google Maps
      </p>
      <p className="max-w-md text-sm text-muted-fg">{MAPS_HELP}</p>
      {detalle && (
        <p className="max-w-md rounded-lg bg-card px-3 py-2 text-left text-[11px] text-muted-fg">
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
  loadError,
}: {
  children: ReactNode;
  defaultCenter: { lat: number; lng: number };
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
    >
      {children}
    </Map>
  );
}

export function MapaClient() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [sectores, setSectores] = useState<Sector[]>([]);
  const [cobertura, setCobertura] = useState<CoberturaSector[]>([]);
  const [colaItems, setColaItems] = useState<ColaItem[]>([]);
  const [minizonas, setMinizonas] = useState<Minizona[]>([]);
  const [visitas, setVisitas] = useState<VisitaPin[]>([]);
  const [sectorSel, setSectorSel] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Minizona | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mostrarHex, setMostrarHex] = useState(true);

  const cargar = useCallback(async () => {
    const supabase = createClient();
    const [sec, cob, cola, min, vis] = await Promise.all([
      supabase.from("sectores").select("*").order("nombre"),
      supabase.from("cobertura_sector").select("*"),
      supabase.from("cola_items").select("*, sectores(*)").not("regla", "is", null),
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
    setColaItems((cola.data as ColaItem[]) || []);
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
  const colaSector = colaItems.find((c) => c.sector_id === sectorSel) ?? null;

  /** Sectores con regla activa y coordenadas ya resueltas: la capa de riesgo pinta estos. */
  const sectoresPrioridad: SectorPrioridad[] = useMemo(
    () =>
      colaItems
        .map((c): SectorPrioridad | null => {
          const s = sectores.find((x) => x.id === c.sector_id);
          if (!s?.lat || !s?.lon || !c.regla || c.regla === "C") return null;
          return {
            sector_id: s.id,
            lat: s.lat,
            lon: s.lon,
            // Antes de generar la malla todavía no hay radio_m guardado: se usa la
            // misma estimación automática, así el círculo de prioridad aparece de
            // una vez y no solo después de tocar "Generar cobertura".
            radio_m: s.radio_m ?? radioAutomatico(c.regla, c.puntaje),
            regla: c.regla,
            puntaje: c.puntaje,
            label: etiquetaZona(c.regla),
          };
        })
        .filter((x): x is SectorPrioridad => x != null),
    [colaItems, sectores]
  );

  /** Solo lo que hoy importa: nada de hexágonos sueltos de sectores sin regla activa. */
  const sectorIdsPrioridad = useMemo(
    () => new Set(sectoresPrioridad.map((s) => s.sector_id)),
    [sectoresPrioridad]
  );

  const visibles = useMemo(() => {
    if (sectorSel) return minizonas.filter((m) => m.sector_id === sectorSel);
    return minizonas.filter((m) => sectorIdsPrioridad.has(m.sector_id));
  }, [minizonas, sectorSel, sectorIdsPrioridad]);

  const visitasVisibles = useMemo(() => {
    if (sectorSel) return visitas.filter((v) => v.sector_id === sectorSel);
    return visitas.filter((v) => v.sector_id && sectorIdsPrioridad.has(v.sector_id));
  }, [visitas, sectorSel, sectorIdsPrioridad]);

  const sinCobertura = !!sectorSel && (!cobSector || !Number(cobSector.minizonas_total));

  useEffect(() => {
    setDetalle(null);
  }, [sectorSel]);

  async function generarCobertura() {
    if (!sectorSel) return;
    setTrabajando(true);
    setMsg(null);
    const res = await fetch("/api/minizonas/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector_id: sectorSel }),
    });
    const json = await res.json();
    setMsg(
      res.ok
        ? `Cobertura generada: ${json.generadas} minizonas · radio ${json.radio_m} m (${etiquetaZona(json.regla)}, puntaje ${json.puntaje}).`
        : json.error
    );
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
        <CardHead titulo="Sectores priorizados por el sistema" />
        <p className="mb-2 text-[11.5px] text-muted-fg">
          El jefe supervisa; el radio y el orden los decide el puntaje de corte de agua +
          almacenamiento (motor de reglas), no un clic manual.
        </p>
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs font-bold text-fg">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={mostrarHex}
            onChange={(e) => setMostrarHex(e.target.checked)}
          />
          Mostrar hexágonos (minizonas)
        </label>
        {sectores.filter((s) => colaItems.some((c) => c.sector_id === s.id)).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-fg">
            Sin zonas riesgosas o medias activas por ahora.
          </p>
        ) : (
          <div className="max-h-[280px] space-y-1 overflow-y-auto">
            {sectores
              .filter((s) => colaItems.some((c) => c.sector_id === s.id))
              .map((s) => {
                const c = cobertura.find((x) => x.sector_id === s.id);
                const cola = colaItems.find((x) => x.sector_id === s.id);
                const activo = s.id === sectorSel;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSectorSel(activo ? null : s.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                      activo ? "bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold">{s.nombre}</p>
                      <p className="text-[11.5px] text-muted-fg">
                        {c && Number(c.minizonas_total)
                          ? `${c.minizonas_cubiertas}/${c.minizonas_total} minizonas · ${c.pct_cobertura}%`
                          : "Sin generar todavía"}
                      </p>
                    </div>
                    {cola?.regla && (
                      <Pill tono={cola.regla === "A" ? "alto" : "medio"}>
                        Puntaje {cola.puntaje}
                      </Pill>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </Card>

      {sector && (
        <Card>
          <CardHead titulo={sector.nombre} />
          {!colaSector?.regla ? (
            <p className="text-sm text-muted-fg">
              Este sector no tiene prioridad activa en la cola: el sistema no genera
              cobertura hasta que el puntaje lo priorice.
            </p>
          ) : sinCobertura ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-fg">{colaSector.justificacion}</p>
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-fg">
                Al generar, el sistema resuelve el centro y elige el radio según{" "}
                <b className="text-fg">
                  {etiquetaZona(colaSector.regla)} · puntaje {colaSector.puntaje}
                </b>
                .
              </div>
              <button
                type="button"
                disabled={trabajando}
                onClick={generarCobertura}
                className="btn-primary"
              >
                {trabajando ? "Generando…" : "Generar cobertura automática"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-muted-fg">Cobertura</span>
                  <span className="font-heading text-sm font-bold">{cobSector!.pct_cobertura}%</span>
                </div>
                <Progreso pct={Number(cobSector!.pct_cobertura) || 0} />
                <p className="mt-1 text-[11px] text-muted-fg">
                  {cobSector!.minizonas_cubiertas} cubiertas · {cobSector!.minizonas_en_curso} en curso ·{" "}
                  {Number(cobSector!.minizonas_total) -
                    Number(cobSector!.minizonas_cubiertas) -
                    Number(cobSector!.minizonas_en_curso)}{" "}
                  pendientes
                </p>
              </div>

              {Number(cobSector!.minizonas_cerco) > 0 && (
                <div className="rounded-lg bg-risk-alto-bg p-3">
                  <p className="text-xs font-bold text-risk-alto">
                    Cercos perifocales: {cobSector!.cercos_cerrados}/{cobSector!.minizonas_cerco}{" "}
                    cerrados
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-fg">
                    Minizonas abiertas alrededor de un foco confirmado (~225 m).
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={trabajando}
                onClick={repartir}
                className="btn-primary"
              >
                {trabajando ? "Repartiendo…" : "Repartir entre brigadistas"}
              </button>
              <p className="text-[11px] text-muted-fg">
                El reparto es geográfico: cada brigadista recibe un bloque contiguo.
              </p>
            </div>
          )}
        </Card>
      )}

      {detalle && (
        <Card>
          <CardHead titulo={etiquetaMinizona(detalle.h3)} />
          <p className="text-sm text-muted-fg">
            Estado: <b className="text-fg">{detalle.estado}</b> ·{" "}
            {detalle.origen === "cerco" ? "abierta por un foco vecino" : "parte de la malla"}
          </p>
          <p className="mt-1 text-xs text-muted-fg">
            Meta: {detalle.meta_viviendas} viviendas · {detalle.lat.toFixed(5)},{" "}
            {detalle.lon.toFixed(5)}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 px-1 text-[11px] text-muted-fg">
        <span className="w-full text-[10.5px] font-bold uppercase tracking-wide text-muted-fg">
          Leyenda
        </span>
        {[
          ["#DC2626", "Zona riesgosa / cerco"],
          ["#CA8A04", "Zona media / en curso"],
          ["#16A34A", "Minizona cubierta"],
          ["#1E40AF", "Minizona pendiente"],
        ].map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full opacity-70" style={{ background: color }} aria-hidden />
            {label}
          </span>
        ))}
      </div>

      {msg && <p className="px-1 text-xs font-bold text-primary">{msg}</p>}
    </div>
  );

  if (!apiKey) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <p className="font-heading font-bold">Falta la clave de Google Maps</p>
          <p className="mt-1 max-w-sm text-sm text-muted-fg">
            Definí <code className="rounded bg-muted px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
            en <code className="rounded bg-muted px-1">.env.local</code> para ver el mapa real.
            Todo lo demás del panel funciona sin ella.
          </p>
          <p className="mt-3 max-w-sm text-xs text-muted-fg">{MAPS_HELP}</p>
        </Card>
        {panelLateral}
      </div>
    );
  }

  const mapDefaultCenter = sector?.lat && sector?.lon ? { lat: sector.lat, lng: sector.lon } : CENTRO_GUAYAQUIL;

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
            <MapaOError defaultCenter={mapDefaultCenter} loadError={mapsError}>
              {visibles.length > 0 ? (
                <FitBounds minizonas={visibles} padding={56} />
              ) : sector?.lat && sector?.lon ? (
                <FitBounds puntos={[{ lat: sector.lat, lng: sector.lon }]} />
              ) : sectoresPrioridad.length > 0 ? (
                <FitBounds
                  puntos={sectoresPrioridad.map((s) => ({ lat: s.lat, lng: s.lon }))}
                  padding={80}
                />
              ) : null}
              <CapaSectorRiesgo sectores={sectoresPrioridad} onSeleccionar={setSectorSel} />
              {mostrarHex && (
                <CapaMinizonas
                  minizonas={visibles}
                  seleccionadaId={detalle?.id}
                  onSeleccionar={setDetalle}
                />
              )}
              <CapaVisitas visitas={visitasVisibles} />
            </MapaOError>
          </APIProvider>
        </div>
      </Card>
      {panelLateral}
    </div>
  );
}
