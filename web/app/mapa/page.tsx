import { PanelShell } from "@/components/layout/PanelShell";
import { MapaClient } from "@/components/mapa/MapaClient";
import { requireRol } from "@/lib/auth";

export default async function MapaPage() {
  const perfil = await requireRol("jefe");
  return (
    <PanelShell
      perfil={perfil}
      title="Mapa de riesgo"
      subtitle="Guayaquil urbano · panal de ~1 km"
    >
      <MapaClient />
    </PanelShell>
  );
}
