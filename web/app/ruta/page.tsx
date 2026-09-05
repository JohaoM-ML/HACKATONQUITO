import { DashboardShell } from "@/components/layout/DashboardShell";
import { RutaClient } from "@/components/ruta/RutaClient";
import { requireRol } from "@/lib/auth";

export default async function RutaPage() {
  const perfil = await requireRol("brigadista");
  return (
    <DashboardShell perfil={perfil} title="Ruta del día">
      <RutaClient brigadistaId={perfil.id} />
    </DashboardShell>
  );
}
