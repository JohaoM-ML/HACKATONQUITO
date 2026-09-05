"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoError } from "@/components/estados/Estados";
import { Avatar, Card, CardHead, KpiCard, Pill, Progreso } from "@/components/panel/Tarjetas";
import { GraficoArea, type PuntoSerie } from "@/components/panel/GraficoArea";
import { celdasEnOrden, rutaDelDia } from "@/lib/geo/minizonas";
import type { CoberturaSector, IndicesSector, Perfil } from "@/types";
import { cn } from "@/lib/utils";

type VisitaLite = {
  id: string;
  fecha_hora: string;
  estado_visita: string;
  brigadista_id: string;
  recipientes: { positivo_larvas: boolean | null; positivo_pupas: boolean | null }[];
};

type CorteLite = {
  id: string;
  fecha_inicio: string;
  duracion_horas: string | null;
  sectores: { nombre: string } | null;
};

function iniciales(n: string) {
  return n.trim().charAt(0).toUpperCase();
}

function diaCorto(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

function haceCuanto(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const dias = Math.floor(ms / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} d`;
}

function Semaforo({
  valor,
  umbral,
  label,
  nombre,
}: {
  valor: number | null;
  umbral: number;
  label: string;
  nombre: string;
}) {
  const ok = valor == null ? null : valor <= umbral;
  const estado =
    ok === null ? "Sin dato" : ok ? "Bajo umbral OPS" : "Sobre umbral OPS";
  return (
    <div className="rounded-lg border border-border bg-bg px-2 py-3 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">{label}</p>
      <p
        className={cn(
          "font-heading text-[26px] font-bold leading-tight",
          ok === null ? "text-muted-fg" : ok ? "text-risk-bajo" : "text-risk-alto"
        )}
      >
        {valor ?? "—"}
      </p>
      <p className="text-[11px] font-bold text-fg">umbral OPS {umbral}</p>
      <p
        className={cn(
          "mt-1 text-[10px] font-bold leading-tight",
          ok === null ? "text-muted-fg" : ok ? "text-risk-bajo" : "text-risk-alto"
        )}
      >
        {estado}
      </p>
      <p className="mt-0.5 text-[10px] leading-tight text-muted-fg">{nombre}</p>
    </div>
  );
}

export function PanelClient({ perfil }: { perfil: Perfil }) {
  const [cobertura, setCobertura] = useState<CoberturaSector[]>([]);
  const [indices, setIndices] = useState<IndicesSector[]>([]);
  const [visitas, setVisitas] = useState<VisitaLite[]>([]);
  const [cortes, setCortes] = useState<CorteLite[]>([]);
  const [brigadistas, setBrigadistas] = useState<{ id: string; nombre: string }[]>([]);
  const [asignaciones, setAsignaciones] = useState<
    { brigadista_id: string; orden: number | null; minizonas: { estado: string } | null }[]
  >([]);
  const [nA, setNA] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const desde = new Date(Date.now() - 13 * 86400000).toISOString();

      const [cob, idx, vis, cor, brig, asig, colaA] = await Promise.all([
        supabase.from("cobertura_sector").select("*"),
        supabase.from("indices_sector").select("*").order("semana", { ascending: false }),
        supabase
          .from("visitas")
          .select("id, fecha_hora, estado_visita, brigadista_id, recipientes(positivo_larvas, positivo_pupas)")
          .gte("fecha_hora", desde)
          .order("fecha_hora", { ascending: true }),
        supabase
          .from("cortes")
          .select("id, fecha_inicio, duracion_horas, sectores(nombre)")
          .order("fecha_inicio", { ascending: false })
          .limit(8),
        supabase
          .from("perfiles")
          .select("id, nombre")
          .eq("rol", "brigadista")
          .eq("brigada_id", perfil.brigada_id ?? ""),
        supabase.from("asignaciones_minizona").select("brigadista_id, orden, minizonas(estado)"),
        supabase.from("cola_items").select("*", { count: "exact", head: true }).eq("regla", "A"),
      ]);

      if (cob.error) setError(cob.error.message);
      setCobertura((cob.data as CoberturaSector[]) || []);
      setIndices((idx.data as IndicesSector[]) || []);
      setVisitas((vis.data as unknown as VisitaLite[]) || []);
      setCortes((cor.data as unknown as CorteLite[]) || []);
      setBrigadistas(brig.data || []);
      setAsignaciones((asig.data as unknown as typeof asignaciones) || []);
      setNA(colaA.count || 0);
      setLoading(false);
    }
    load();
  }, [perfil.brigada_id]);

  if (loading) return <EstadoCargando />;
  if (error) return <EstadoError mensaje={error} />;

  // --- KPIs ---
  const miniTotal = cobertura.reduce((a, c) => a + Number(c.minizonas_total || 0), 0);
  const miniCubiertas = cobertura.reduce((a, c) => a + Number(c.minizonas_cubiertas || 0), 0);
  const cercosAbiertos = cobertura.reduce((a, c) => a + Number(c.minizonas_cerco || 0), 0);
  const cercosCerrados = cobertura.reduce((a, c) => a + Number(c.cercos_cerrados || 0), 0);
  const pctCobertura = miniTotal ? Math.round((miniCubiertas / miniTotal) * 100) : null;
  const pctCercos = cercosAbiertos ? Math.round((cercosCerrados / cercosAbiertos) * 100) : null;

  const esFoco = (v: VisitaLite) =>
    v.recipientes?.some((r) => r.positivo_larvas || r.positivo_pupas);
  const focos = visitas.filter(esFoco).length;

  const hoy = new Date().toDateString();
  const visitasHoy = visitas.filter((v) => new Date(v.fecha_hora).toDateString() === hoy);
  const activosHoy = new Set(visitasHoy.map((v) => v.brigadista_id)).size;

  // --- Serie diaria de cobertura ---
  const porDia = new Map<string, { total: number; focos: number }>();
  for (const v of visitas) {
    const k = v.fecha_hora.slice(0, 10);
    const acc = porDia.get(k) || { total: 0, focos: 0 };
    acc.total += 1;
    if (esFoco(v)) acc.focos += 1;
    porDia.set(k, acc);
  }
  const serie: PuntoSerie[] = Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([fecha, v]) => ({
      etiqueta: diaCorto(fecha),
      valor: v.total,
      detalle: `${diaCorto(fecha)} · ${v.total} viviendas · ${v.focos} con foco`,
    }));

  // --- Índices ---
  const ultimoPorSector = new Map<string, IndicesSector>();
  for (const r of indices) if (!ultimoPorSector.has(r.sector_id)) ultimoPorSector.set(r.sector_id, r);
  const sectores = Array.from(ultimoPorSector.values());
  const promedio = (key: keyof IndicesSector) => {
    const vals = sectores.map((s) => s[key]).filter((v): v is number => typeof v === "number");
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };

  // --- Roster ---
  // "hechas"/"asignadas" son el bloque completo (multi-día); "hoy" es el cupo real del
  // día (META_MINIZONAS_DIA = 8), la misma cuenta que ve el brigadista en su ruta.
  const roster = brigadistas.map((b) => {
    const mias = asignaciones.filter((a) => a.brigadista_id === b.id);
    const bloque = celdasEnOrden(mias.map((a) => ({ orden: a.orden, minizonas: a.minizonas })));
    const hechas = bloque.filter((m) => m.estado === "cubierta").length;
    const hoy = rutaDelDia(bloque).length;
    const visitasDeHoy = visitasHoy.filter((v) => v.brigadista_id === b.id).length;
    return {
      ...b,
      asignadas: bloque.length,
      hechas,
      hoy,
      visitasHoy: visitasDeHoy,
      activo: visitasDeHoy > 0,
    };
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiCard
          color="blue"
          label="Cobertura de minizonas"
          valor={miniTotal ? `${miniCubiertas} / ${miniTotal}` : "—"}
          nota={
            miniTotal
              ? `${pctCobertura}% del territorio delimitado ya tiene su cuota de viviendas`
              : "Delimita un sector en el mapa para generar la malla"
          }
        />
        <KpiCard
          color="red"
          label="Cercos cerrados"
          valor={cercosAbiertos ? `${cercosCerrados} / ${cercosAbiertos}` : "—"}
          nota={
            cercosAbiertos
              ? `${pctCercos}% de los focos tiene su perímetro de 225 m inspeccionado`
              : "Sin focos confirmados todavía"
          }
        />
        <KpiCard
          color="gold"
          label="Focos detectados (14 d)"
          valor={focos}
          nota="Viviendas con al menos un recipiente positivo a larvas o pupas"
        />
        <KpiCard
          color="green"
          label="Brigadistas activos hoy"
          valor={`${activosHoy} / ${brigadistas.length}`}
          nota={`${visitasHoy.length} viviendas registradas hoy · ${nA} zonas riesgosas`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHead
            titulo="Viviendas registradas por día"
            extra={
              <span className="text-[11.5px] text-muted-fg">Fuente: registros de la brigada</span>
            }
          />
          <div className="mb-1.5 flex items-baseline gap-2.5">
            <span className="font-heading text-[26px] font-bold">{visitas.length}</span>
            <span className="text-xs text-muted-fg">viviendas en los últimos 14 días</span>
          </div>
          <p className="mb-2.5 text-xs text-muted-fg">
            Mide esfuerzo de campo y cobertura, no reducción de transmisión: para eso harían falta
            datos de casos por barrio, que hoy no son públicos.
          </p>
          <GraficoArea datos={serie} />
        </Card>

        <Card>
          <CardHead
            titulo="Cortes reportados"
            extra={
              <Link href="/avisos" className="text-[12.5px] font-semibold text-primary">
                Ver todos →
              </Link>
            }
          />
          {cortes.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-fg">Sin cortes registrados.</p>
          ) : (
            <div>
              {cortes.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2.5 border-b border-border py-2.5 last:border-0 last:pb-0 first:pt-0"
                >
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-risk-alto" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] font-semibold">
                      {c.sectores?.nombre ?? "Sector sin nombre"}
                    </b>
                    <span className="text-[11.5px] text-muted-fg">
                      Corte {c.duracion_horas ? `· ${c.duracion_horas}` : "· duración no publicada"}
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-fg">
                    {haceCuanto(c.fecha_inicio)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHead titulo="Presencia de zancudo (HI/CI/BI)" />
          <div className="grid grid-cols-3 gap-2">
            <Semaforo label="HI" nombre="Índice de vivienda" valor={promedio("hi")} umbral={4} />
            <Semaforo label="CI" nombre="Índice de recipientes" valor={promedio("ci")} umbral={3} />
            <Semaforo label="BI" nombre="Índice de Breteau" valor={promedio("bi")} umbral={5} />
          </div>
          <p className="mt-3 text-xs text-muted-fg">
            Promedio de los sectores con registros. En rojo, por encima del umbral OPS.
          </p>
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-fg">
              Positivos que son de almacenamiento
            </p>
            <p className="font-heading text-2xl font-bold text-accent">
              {promedio("pct_positivos_almacenamiento") ?? "—"}
              {promedio("pct_positivos_almacenamiento") != null ? "%" : ""}
            </p>
            <p className="text-xs text-muted-fg">
              Prueba directa de la hipótesis cortes → almacenamiento → criadero.
            </p>
          </div>
        </Card>

        <Card>
          <CardHead
            titulo="Avance por brigadista"
            extra={
              <Link href="/equipo" className="text-[12.5px] font-semibold text-primary">
                Ver equipo completo →
              </Link>
            }
          />
          {roster.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-fg">
              Aún no hay brigadistas registrados en esta brigada.
            </p>
          ) : (
            <div>
              {roster.slice(0, 5).map((b) => {
                const pct = b.asignadas ? (b.hechas / b.asignadas) * 100 : 0;
                return (
                  <div
                    key={b.id}
                    className="grid grid-cols-[auto_1.4fr_1fr_auto] items-center gap-3.5 border-b border-border py-3 last:border-0 last:pb-0 first:pt-0"
                  >
                    <Avatar texto={iniciales(b.nombre)} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold">{b.nombre}</p>
                      <p className="text-[11.5px] text-muted-fg">
                        {b.visitasHoy} viviendas hoy
                      </p>
                    </div>
                    <div>
                      <Progreso pct={pct} />
                      <p className="mt-1 text-[11px] text-muted-fg">
                        {b.hoy} hoy · {b.hechas}/{b.asignadas} en su bloque
                      </p>
                    </div>
                    <Pill tono={b.activo ? "on" : "off"}>{b.activo ? "Activo" : "Sin registros"}</Pill>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHead
          titulo="Cobertura por sector"
          extra={
            <Link href="/mapa" className="text-[12.5px] font-semibold text-primary">
              Abrir mapa →
            </Link>
          }
        />
        {cobertura.length === 0 ? (
          <p className="py-5 text-center text-sm text-muted-fg">Sin sectores cargados.</p>
        ) : (
          <div>
            {[...cobertura]
              .sort((a, b) => (Number(b.minizonas_cerco) || 0) - (Number(a.minizonas_cerco) || 0))
              .map((c) => {
                const total = Number(c.minizonas_total) || 0;
                const cub = Number(c.minizonas_cubiertas) || 0;
                const pct = total ? Math.round((cub / total) * 100) : 0;
                return (
                  <div
                    key={c.sector_id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 border-b border-border py-3 last:border-0 last:pb-0 first:pt-0"
                  >
                    <Avatar
                      texto={iniciales(c.sector_nombre)}
                      tono={Number(c.minizonas_cerco) > 0 ? "alto" : "neutro"}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold">{c.sector_nombre}</p>
                      <p className="text-[11.5px] text-muted-fg">
                        {total
                          ? `${cub} / ${total} minizonas · ${c.zona || "Sur"}`
                          : "Sin malla delimitada"}
                      </p>
                      {total > 0 && (
                        <div className="mt-1.5 max-w-[220px]">
                          <Progreso pct={pct} />
                        </div>
                      )}
                    </div>
                    {Number(c.minizonas_cerco) > 0 ? (
                      <Pill tono="alto">
                        {c.cercos_cerrados}/{c.minizonas_cerco} cerco
                      </Pill>
                    ) : (
                      <Pill tono={total ? "on" : "off"}>{total ? `${pct}%` : "—"}</Pill>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <a href="/api/export/dataset" className="btn-primary w-auto px-5">
          Exportar dataset CSV
        </a>
        <Link href="/mapa" className="btn-secondary w-auto px-5">
          Abrir mapa de riesgo y hexágonos
        </Link>
      </div>
    </div>
  );
}
