import { PanelShell, LivePill } from "@/components/layout/PanelShell";
import { PanelClient } from "@/components/panel/PanelClient";
import { requireRol } from "@/lib/auth";

export default async function PanelPage() {
  const perfil = await requireRol("jefe");
  const hoy = new Date().toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <PanelShell
      perfil={perfil}
      title="Resumen"
      subtitle={`Guayaquil · ${hoy}`}
      actions={<LivePill texto="Datos de campo en vivo" />}
    >
      <PanelClient perfil={perfil} />
    </PanelShell>
  );
}
