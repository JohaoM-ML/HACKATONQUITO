import { DashboardShell } from "@/components/layout/DashboardShell";
import { requirePerfil } from "@/lib/auth";

export default async function PerfilPage() {
  const perfil = await requirePerfil();
  return (
    <DashboardShell perfil={perfil} title="Perfil">
      <div className="card space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase text-ios-label-3">Nombre</p>
          <p className="font-heading text-lg font-bold">{perfil.nombre}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-ios-label-3">Rol</p>
          <p className="capitalize">{perfil.rol}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-ios-label-3">Brigada</p>
          <p className="text-sm text-ios-label-2">{perfil.brigada_id || "—"}</p>
        </div>
        <p className="text-xs text-ios-label-3">
          La app es online: requiere conexión para guardar visitas en Supabase.
        </p>
      </div>
    </DashboardShell>
  );
}
