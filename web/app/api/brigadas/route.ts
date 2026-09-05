import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/** Crea brigada + usuario jefe (service role). Usado en registro de jefe. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, email, password, nombre_persona } = body;
    if (!nombre || !email || !password || !nombre_persona) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Sin service role: crear usuario vía signUp y brigada después (RLS limita)
    if (!serviceKey) {
      const anonClient = createClient(url, anon);
      const { data, error } = await anonClient.auth.signUp({
        email,
        password,
        options: { data: { nombre: nombre_persona, rol: "jefe" } },
      });
      if (error || !data.user) {
        return NextResponse.json({ error: error?.message || "signup falló" }, { status: 400 });
      }
      // Insertar brigada requiere ser jefe — el trigger ya creó perfil jefe
      // Usamos el session del signup si existe
      const client = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${data.session?.access_token}` } },
      });
      if (data.session) {
        const { data: brigada, error: bErr } = await client
          .from("brigadas")
          .insert({ nombre, canton: "Guayaquil", jefe_id: data.user.id })
          .select("id")
          .single();
        if (!bErr && brigada) {
          await client.from("perfiles").update({ brigada_id: brigada.id }).eq("id", data.user.id);
        }
      }
      return NextResponse.json({ ok: true, user_id: data.user.id });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: uErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre_persona, rol: "jefe" },
    });
    if (uErr || !created.user) {
      return NextResponse.json({ error: uErr?.message || "createUser falló" }, { status: 400 });
    }

    const { data: brigada, error: bErr } = await admin
      .from("brigadas")
      .insert({ nombre, canton: "Guayaquil", jefe_id: created.user.id })
      .select("id")
      .single();
    if (bErr) {
      return NextResponse.json({ error: bErr.message }, { status: 400 });
    }

    await admin
      .from("perfiles")
      .upsert({
        id: created.user.id,
        nombre: nombre_persona,
        rol: "jefe",
        brigada_id: brigada.id,
      });

    return NextResponse.json({ ok: true, brigada_id: brigada.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
