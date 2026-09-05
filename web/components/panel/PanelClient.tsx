"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoError, EstadoVacio } from "@/components/estados/Estados";
import type { IndicesSector } from "@/types";
import { cn } from "@/lib/utils";

function Semaforo({ valor, umbral, label }: { valor: number | null; umbral: number; label: string }) {
  const ok = valor == null ? null : valor <= umbral;
  return (
    <div className="card text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ios-label-3">{label}</p>
      <p
        className={cn(
          "font-heading text-3xl font-bold",
          ok === null ? "text-ios-label-3" : ok ? "text-ios-green" : "text-ios-red"
        )}
      >
        {valor == null ? "—" : valor}
      </p>
      <p className="text-xs text-ios-label-3">umbral OPS {umbral}</p>
    </div>
  );
}

export function PanelClient() {
  const [rows, setRows] = useState<IndicesSector[]>([]);
  const [nA, setNA] = useState(0);
  const [nVisitas, setNVisitas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: idx, error: e1 }, { count: cA }, { count: cV }] = await Promise.all([
        supabase.from("indices_sector").select("*").order("semana", { ascending: false }),
        supabase.from("cola_items").select("*", { count: "exact", head: true }).eq("regla", "A"),
        supabase.from("visitas").select("*", { count: "exact", head: true }),
      ]);
      if (e1) setError(e1.message);
      setRows((idx as IndicesSector[]) || []);
      setNA(cA || 0);
      setNVisitas(cV || 0);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <EstadoCargando />;
  if (error) return <EstadoError mensaje={error} />;

  const latestBySector = new Map<string, IndicesSector>();
  for (const r of rows) {
    if (!latestBySector.has(r.sector_id)) latestBySector.set(r.sector_id, r);
  }
  const sectores = Array.from(latestBySector.values());

  const avg = (key: keyof IndicesSector) => {
    const vals = sectores.map((s) => s[key]).filter((v): v is number => typeof v === "number");
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-[11px] font-semibold uppercase text-ios-label-3">Cola Regla A</p>
          <p className="font-heading text-2xl font-bold text-primary">{nA}</p>
        </div>
        <div className="card">
          <p className="text-[11px] font-semibold uppercase text-ios-label-3">Visitas</p>
          <p className="font-heading text-2xl font-bold text-primary">{nVisitas}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 font-heading text-sm font-bold">Índices Stegomyia (promedio sectores)</p>
        <div className="grid grid-cols-3 gap-2">
          <Semaforo label="HI" valor={avg("hi")} umbral={4} />
          <Semaforo label="CI" valor={avg("ci")} umbral={3} />
          <Semaforo label="BI" valor={avg("bi")} umbral={5} />
        </div>
        <p className="mt-2 text-xs text-ios-label-3">
          Umbrales OPS: HI 4 · CI 3 · BI 5. Rojo = por encima del umbral.
        </p>
      </div>

      <div className="card">
        <p className="text-[11px] font-semibold uppercase text-ios-label-3">
          % positivos de almacenamiento
        </p>
        <p className="font-heading text-2xl font-bold text-ios-orange">
          {avg("pct_positivos_almacenamiento") ?? "—"}
          {avg("pct_positivos_almacenamiento") != null ? "%" : ""}
        </p>
        <p className="text-xs text-ios-label-2">
          Prueba directa de la hipótesis cortes → almacenamiento → criadero
        </p>
      </div>

      {sectores.length === 0 ? (
        <EstadoVacio
          titulo="Sin índices aún"
          descripcion="Cuando los brigadistas registren visitas inspeccionadas, aquí verás HI/CI/BI por sector."
        />
      ) : (
        <ul className="space-y-2">
          {sectores.map((s) => (
            <li key={s.sector_id} className="card">
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold">{s.sector_nombre}</p>
                <span className="text-xs text-ios-label-3">{s.zona || ""}</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                <div>
                  <p className="font-bold">{s.hi ?? "—"}</p>
                  <p className="text-ios-label-3">HI</p>
                </div>
                <div>
                  <p className="font-bold">{s.ci ?? "—"}</p>
                  <p className="text-ios-label-3">CI</p>
                </div>
                <div>
                  <p className="font-bold">{s.bi ?? "—"}</p>
                  <p className="text-ios-label-3">BI</p>
                </div>
                <div>
                  <p className="font-bold">{s.viviendas_inspeccionadas}</p>
                  <p className="text-ios-label-3">viv.</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <a href="/api/export/dataset" className="btn-secondary block text-center">
        Exportar dataset CSV (recipientes)
      </a>
    </div>
  );
}
