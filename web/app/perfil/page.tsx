import { DashboardShell } from "@/components/layout/DashboardShell";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PerfilPage() {
  const perfil = await requirePerfil();
  const supabase = createClient();

  let brigadaNombre: string | null = null;
  if (perfil.brigada_id) {
    const { data } = await supabase
      .from("brigadas")
      .select("nombre")
      .eq("id", perfil.brigada_id)
      .maybeSingle();
    brigadaNombre = data?.nombre ?? null;
  }

  return (
    <DashboardShell perfil={perfil} title="Perfil">
      <div className="card space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">Nombre</p>
          <p className="font-heading text-lg font-bold text-fg">{perfil.nombre}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">Rol</p>
          <p className="capitalize text-fg">{perfil.rol}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">Brigada</p>
          <p className="text-sm font-bold text-fg">
            {brigadaNombre || (perfil.brigada_id ? "Brigada sin nombre" : "Sin brigada")}
          </p>
        </div>
        <p className="text-xs text-muted-fg">
          ZANKU es online: necesita conexión para guardar visitas.
        </p>
      </div>
    </DashboardShell>
  );
}
