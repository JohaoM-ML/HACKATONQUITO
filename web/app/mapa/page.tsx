import { PanelShell } from "@/components/layout/PanelShell";
import { MapaClient } from "@/components/mapa/MapaClient";
import { requireRol } from "@/lib/auth";

export default async function MapaPage() {
  const perfil = await requireRol("jefe");
  return (
    <PanelShell
      perfil={perfil}
      title="Mapa de riesgo"
      subtitle="Minizonas de ~160 m, la escala a la que se dispersa Aedes aegypti"
    >
      <MapaClient />
    </PanelShell>
  );
}
