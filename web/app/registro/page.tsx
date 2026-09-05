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

    if (rol === "jefe" && nuevaBrigada.trim()) {
      const res = await fetch("/api/brigadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevaBrigada.trim(),
          email,
          password,
          nombre_persona: nombre,
        }),
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
    <div className="min-h-dvh bg-bg">
      <div className="ec-stripe" />
      <div className="mx-auto flex min-h-[calc(100dvh-4px)] w-full max-w-md flex-col justify-center px-5 py-10">
        <h1 className="font-heading text-2xl font-bold text-primary">Crear cuenta</h1>
        <p className="mb-6 text-sm text-muted-fg">ZANKU · rol y brigada en el sistema</p>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label-field">Nombre</label>
            <input
              className="input-field"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">Correo</label>
            <input
              type="email"
              className="input-field"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">Contraseña</label>
            <input
              type="password"
              minLength={6}
              className="input-field"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
                <p className="mt-1 text-xs text-muted-fg">
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

          {error && (
            <p className="text-sm font-bold text-risk-alto" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creando…" : "Registrarme"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-fg">
          ¿Ya tienes cuenta?{" "}
          <Link href="/" className="font-bold text-accent">
            Elegir puerta
          </Link>
        </p>
      </div>
    </div>
  );
}
