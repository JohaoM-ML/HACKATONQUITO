import { PanelShell, LivePill } from "@/components/layout/PanelShell";
import { AvisosClient } from "@/components/avisos/AvisosClient";
import { requireRol } from "@/lib/auth";

export default async function AvisosPage() {
  const perfil = await requireRol("jefe");
  return (
    <PanelShell
      perfil={perfil}
      title="Alertas"
      subtitle="Cortes reportados por Interagua y mensajes listos para enviar"
      actions={<LivePill texto="Cola actualizada" />}
    >
      <AvisosClient />
    </PanelShell>
  );
}
