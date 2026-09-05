"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .maybeSingle();
      router.push(perfil?.rol === "jefe" ? "/panel" : "/ruta");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col justify-center bg-ios-bg px-6 shadow-2xl sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[32px]">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-ec-yellow via-ec-blue to-ec-red" />
        <h1 className="font-heading text-2xl font-bold text-primary">VENTANA SECA</h1>
        <p className="mt-1 text-sm text-ios-label-2">
          Cola de brigadas + captura entomológica
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label-field" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label-field" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm font-medium text-ios-red">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ios-label-2">
        ¿Sin cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primary">
          Registrarse
        </Link>
      </p>
    </div>
  );
}
