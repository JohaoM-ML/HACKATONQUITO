import { DashboardShell } from "@/components/layout/DashboardShell";
import { InspeccionForm } from "@/components/inspeccion/InspeccionForm";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function InspeccionPage({
  params,
  searchParams,
}: {
  params: { sectorId: string };
  searchParams: { cola?: string; minizona?: string };
}) {
  const perfil = await requireRol("brigadista");
  const supabase = createClient();

  const { data: sector } = await supabase
    .from("sectores")
    .select("*")
    .eq("id", params.sectorId)
    .maybeSingle();

  if (!sector) notFound();

  let justificacion: string | null = null;
  let accion: string | null = null;
  let colaItemId = searchParams.cola || null;

  let minizonaId: string | null = searchParams.minizona || null;
  let minizonaH3: string | null = null;
  let minizonaOrigen: string | null = null;

  if (minizonaId) {
    const { data: mz } = await supabase
      .from("minizonas")
      .select("id, h3, origen, sector_id")
      .eq("id", minizonaId)
      .maybeSingle();
    if (mz && mz.sector_id === params.sectorId) {
      minizonaId = mz.id;
      minizonaH3 = mz.h3;
      minizonaOrigen = mz.origen;
    } else {
      minizonaId = null;
    }
  }

  if (colaItemId) {
    const { data: item } = await supabase
      .from("cola_items")
      .select("justificacion, accion")
      .eq("id", colaItemId)
      .maybeSingle();
    justificacion = item?.justificacion ?? null;
    accion = item?.accion ?? null;
  } else {
    const { data: item } = await supabase
      .from("cola_items")
      .select("id, justificacion, accion")
      .eq("sector_id", params.sectorId)
      .eq("regla", "A")
      .order("fecha_eval", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (item) {
      colaItemId = item.id;
      justificacion = item.justificacion;
      accion = item.accion;
    }
  }

  return (
    <DashboardShell perfil={perfil} title="Inspección">
      <InspeccionForm
        sectorId={sector.id}
        sectorNombre={sector.nombre}
        colaItemId={colaItemId}
        justificacion={justificacion}
        accion={accion}
        brigadistaId={perfil.id}
        brigadaId={perfil.brigada_id}
        minizonaId={minizonaId}
        minizonaH3={minizonaH3}
        minizonaOrigen={minizonaOrigen}
      />
    </DashboardShell>
  );
}
