import { DashboardShell } from "@/components/layout/DashboardShell";
import { EquipoClient } from "@/components/equipo/EquipoClient";
import { requireRol } from "@/lib/auth";

export default async function EquipoPage() {
  const perfil = await requireRol("jefe");
  return (
    <DashboardShell perfil={perfil} title="Equipo">
      <EquipoClient brigadaId={perfil.brigada_id} />
    </DashboardShell>
  );
}
