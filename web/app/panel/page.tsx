import { DashboardShell } from "@/components/layout/DashboardShell";
import { PanelClient } from "@/components/panel/PanelClient";
import { requireRol } from "@/lib/auth";

export default async function PanelPage() {
  const perfil = await requireRol("jefe");
  return (
    <DashboardShell perfil={perfil} title="Panel">
      <PanelClient />
    </DashboardShell>
  );
}
