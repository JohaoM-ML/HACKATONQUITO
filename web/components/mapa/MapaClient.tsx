"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import type { Sector } from "@/types";

export function MapaClient() {
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from("sectores")
      .select("*")
      .not("lat", "is", null)
      .then(({ data }) => {
        setSectores((data as Sector[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <EstadoCargando />;
  if (!sectores.length) {
    return (
      <EstadoVacio
        titulo="Sin coordenadas aún"
        descripcion="El GPS de las visitas inspeccionadas actualiza lat/lon del sector automáticamente."
      />
    );
  }

  const lats = sectores.map((s) => s.lat!);
  const lons = sectores.map((s) => s.lon!);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const pad = 0.01;
  const w = 320;
  const h = 360;

  function xy(lat: number, lon: number) {
    const x = ((lon - (minLon - pad)) / (maxLon - minLon + 2 * pad)) * w;
    const y = (1 - (lat - (minLat - pad)) / (maxLat - minLat + 2 * pad)) * h;
    return { x, y };
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-xl bg-ios-fill-2">
          {sectores.map((s) => {
            const { x, y } = xy(s.lat!, s.lon!);
            return (
              <g key={s.id}>
                <circle cx={x} cy={y} r={10} fill="#E5352B" opacity={0.85} />
                <text x={x} y={y + 22} textAnchor="middle" fontSize="10" fill="#0F172A">
                  {s.nombre.slice(0, 14)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="space-y-2">
        {sectores.map((s) => (
          <li key={s.id} className="card text-sm">
            <p className="font-heading font-bold">{s.nombre}</p>
            <p className="text-xs text-ios-label-3">
              {s.lat?.toFixed(5)}, {s.lon?.toFixed(5)} · {s.zona || "—"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
