import { DashboardShell } from "@/components/layout/DashboardShell";
import { MisRegistrosClient } from "@/components/registros/MisRegistrosClient";
import { requireRol } from "@/lib/auth";

export default async function MisRegistrosPage() {
  const perfil = await requireRol("brigadista");
  return (
    <DashboardShell perfil={perfil} title="Mis registros">
      <MisRegistrosClient brigadistaId={perfil.id} />
    </DashboardShell>
  );
}
