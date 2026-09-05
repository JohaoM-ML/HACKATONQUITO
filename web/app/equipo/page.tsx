import { PanelShell } from "@/components/layout/PanelShell";
import { EquipoClient } from "@/components/equipo/EquipoClient";
import { requireRol } from "@/lib/auth";

export default async function EquipoPage() {
  const perfil = await requireRol("jefe");
  return (
    <PanelShell
      perfil={perfil}
      title="Brigada"
      subtitle="Minizonas asignadas y avance de cobertura por brigadista"
    >
      <EquipoClient brigadaId={perfil.brigada_id} />
    </PanelShell>
  );
}
