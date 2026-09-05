"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EstadoCargando, EstadoVacio } from "@/components/estados/Estados";
import type { Perfil } from "@/types";

type Row = Perfil & { visitas: number };

export function EquipoClient({ brigadaId }: { brigadaId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      let q = supabase.from("perfiles").select("*").eq("rol", "brigadista");
      if (brigadaId) q = q.eq("brigada_id", brigadaId);
      const { data: perfiles } = await q;
      const list = (perfiles as Perfil[]) || [];
      const withCounts: Row[] = [];
      for (const p of list) {
        const { count } = await supabase
          .from("visitas")
          .select("*", { count: "exact", head: true })
          .eq("brigadista_id", p.id);
        withCounts.push({ ...p, visitas: count || 0 });
      }
      setRows(withCounts);
      setLoading(false);
    }
    load();
  }, [brigadaId]);

  if (loading) return <EstadoCargando />;
  if (!rows.length) {
    return (
      <EstadoVacio
        titulo="Sin brigadistas"
        descripcion="Pide a tu equipo que se registre con el rol brigadista y tu brigada."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="card flex items-center justify-between">
          <div>
            <p className="font-heading font-bold">{r.nombre}</p>
            <p className="text-xs text-ios-label-3">{r.telefono || "sin teléfono"}</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-xl font-bold text-primary">{r.visitas}</p>
            <p className="text-[11px] text-ios-label-3">visitas</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
