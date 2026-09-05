import { DashboardShell } from "@/components/layout/DashboardShell";
import { ColaJefeClient } from "@/components/cola/ColaJefeClient";
import { requireRol } from "@/lib/auth";

export default async function ColaPage() {
  const perfil = await requireRol("jefe");
  return (
    <DashboardShell perfil={perfil} title="Cola completa">
      <ColaJefeClient />
    </DashboardShell>
  );
}
