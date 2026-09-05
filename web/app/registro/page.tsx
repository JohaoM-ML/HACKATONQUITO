"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Rol } from "@/types";

type BrigadaOpt = { id: string; nombre: string };

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("brigadista");
  const [brigadaId, setBrigadaId] = useState("");
  const [nuevaBrigada, setNuevaBrigada] = useState("");
  const [brigadas, setBrigadas] = useState<BrigadaOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("brigadas")
      .select("id, nombre")
      .then(({ data }) => setBrigadas((data as BrigadaOpt[]) || []));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const brigada_id = brigadaId || null;

    // Jefe puede crear brigada nueva vía API seed (si lista vacía)
    if (rol === "jefe" && nuevaBrigada.trim()) {
      const res = await fetch("/api/brigadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevaBrigada.trim(), email, password, nombre_persona: nombre }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo crear la brigada");
        setLoading(false);
        return;
      }
      router.push("/panel");
      router.refresh();
      return;
    }

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          rol,
          brigada_id: brigada_id || "",
        },
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      // Asegurar perfil (trigger puede demorar)
      await supabase.from("perfiles").upsert({
        id: data.user.id,
        nombre,
        rol,
        brigada_id,
      });
      router.push(rol === "jefe" ? "/panel" : "/ruta");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col justify-center bg-ios-bg px-6 py-8 shadow-2xl sm:my-6 sm:rounded-[32px]">
      <h1 className="font-heading text-2xl font-bold text-primary">Crear cuenta</h1>
      <p className="mb-6 text-sm text-ios-label-2">Rol y brigada se guardan en Supabase</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label-field">Nombre</label>
          <input className="input-field" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className="label-field">Correo</label>
          <input type="email" className="input-field" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label-field">Contraseña</label>
          <input type="password" minLength={6} className="input-field" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div>
          <label className="label-field">Rol</label>
          <div className="grid grid-cols-2 gap-2">
            {(["brigadista", "jefe"] as Rol[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRol(r)}
                className={`chip ${rol === r ? "chip-active" : ""}`}
              >
                {r === "jefe" ? "Jefe de brigada" : "Brigadista"}
              </button>
            ))}
          </div>
        </div>

        {rol === "brigadista" && (
          <div>
            <label className="label-field">Brigada</label>
            <select
              className="input-field"
              value={brigadaId}
              onChange={(e) => setBrigadaId(e.target.value)}
              required={brigadas.length > 0}
            >
              <option value="">— seleccionar —</option>
              {brigadas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
            {brigadas.length === 0 && (
              <p className="mt-1 text-xs text-ios-label-3">
                Aún no hay brigadas. Regístrate primero como jefe.
              </p>
            )}
          </div>
        )}

        {rol === "jefe" && (
          <div>
            <label className="label-field">Nombre de tu brigada</label>
            <input
              className="input-field"
              required
              placeholder="Ej. Brigada Sur Guayaquil"
              value={nuevaBrigada}
              onChange={(e) => setNuevaBrigada(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm font-medium text-ios-red">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Creando…" : "Registrarme"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ios-label-2">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Entrar
        </Link>
      </p>
    </div>
  );
}
