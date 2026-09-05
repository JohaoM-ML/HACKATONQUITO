import { PanelShell } from "@/components/layout/PanelShell";
import { ColaJefeClient } from "@/components/cola/ColaJefeClient";
import { requireRol } from "@/lib/auth";

export default async function ColaPage() {
  const perfil = await requireRol("jefe");
  return (
    <PanelShell
      perfil={perfil}
      title="Cola priorizada"
      subtitle="Zonas riesgosas y medias detectadas por el sistema, con su justificación y trazabilidad"
    >
      <ColaJefeClient />
    </PanelShell>
  );
}
