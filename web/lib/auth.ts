import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/types";

export async function requirePerfil(): Promise<Perfil> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, brigada_id, telefono")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) redirect("/login");
  return perfil as Perfil;
}

export async function requireRol(rol: "brigadista" | "jefe"): Promise<Perfil> {
  const perfil = await requirePerfil();
  if (perfil.rol !== rol) {
    redirect(perfil.rol === "jefe" ? "/panel" : "/ruta");
  }
  return perfil;
}
