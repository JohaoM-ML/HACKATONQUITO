import { DashboardShell } from "@/components/layout/DashboardShell";
import { MapaClient } from "@/components/mapa/MapaClient";
import { requireRol } from "@/lib/auth";

export default async function MapaPage() {
  const perfil = await requireRol("jefe");
  return (
    <DashboardShell perfil={perfil} title="Mapa">
      <MapaClient />
    </DashboardShell>
  );
}
