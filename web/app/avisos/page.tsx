import { DashboardShell } from "@/components/layout/DashboardShell";
import { AvisosClient } from "@/components/avisos/AvisosClient";
import { requireRol } from "@/lib/auth";

export default async function AvisosPage() {
  const perfil = await requireRol("jefe");
  return (
    <DashboardShell perfil={perfil} title="Avisos">
      <AvisosClient />
    </DashboardShell>
  );
}
