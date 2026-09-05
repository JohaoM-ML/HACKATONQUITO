"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Rol } from "@/types";

const DEMO = {
  brigadista: { email: "brigada.ventana@gmail.com", password: "Demo1234!" },
  jefe: { email: "jefe.ventana@gmail.com", password: "Demo1234!" },
} as const;

const COPY: Record<
  Rol,
  {
    kicker: string;
    title: string;
    subtitle: string;
    demoLabel: string;
    wrongRole: string;
    otherHref: string;
    otherLabel: string;
  }
> = {
  brigadista: {
    kicker: "Puerta de campo",
    title: "App de campo",
    subtitle: "Mis zonas, mapa de hexágonos e inspección",
    demoLabel: "Entrar con demo de brigadista",
    wrongRole: "Esta puerta es del brigadista. Entrá por Panel de mando.",
    otherHref: "/jefe",
    otherLabel: "Ir a Panel de mando",
  },
  jefe: {
    kicker: "Puerta de mando",
    title: "Panel de mando",
    subtitle: "Resumen, mapa de riesgo, cola y equipo",
    demoLabel: "Entrar con demo de jefe",
    wrongRole: "Esta puerta es del jefe. Entrá por App de campo.",
    otherHref: "/brigada",
    otherLabel: "Ir a App de campo",
  },
};

export function RoleLogin({
  rol,
  successHref,
}: {
  rol: Rol;
  successHref: string;
}) {
  const router = useRouter();
  const copy = COPY[rol];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function entrar(mail: string, pass: string) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: mail,
      password: pass,
    });
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
      if (perfil?.rol !== rol) {
        await supabase.auth.signOut();
        setError(copy.wrongRole);
        setLoading(false);
        return;
      }
      router.push(successHref);
      router.refresh();
    }
    setLoading(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await entrar(email, password);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col justify-center bg-ios-bg px-6 shadow-2xl sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[32px]">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-ec-yellow via-ec-blue to-ec-red" />
        <p className="font-heading text-[11px] font-semibold uppercase tracking-wide text-ios-label-3">
          {copy.kicker}
        </p>
        <h1 className="font-heading text-2xl font-bold text-primary">VENTANA SECA</h1>
        <p className="mt-1 font-heading text-base font-semibold text-ios-label">{copy.title}</p>
        <p className="mt-1 text-sm text-ios-label-2">{copy.subtitle}</p>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => entrar(DEMO[rol].email, DEMO[rol].password)}
        className="btn-primary cursor-pointer"
      >
        {copy.demoLabel}
      </button>
      <p className="mt-2 text-center text-[11px] text-ios-label-3">
        {DEMO[rol].email}
      </p>

      <div className="my-4 flex items-center gap-3 text-[11px] text-ios-label-3">
        <span className="h-px flex-1 bg-ios-sep" />
        o con correo
        <span className="h-px flex-1 bg-ios-sep" />
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
        {error && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-ios-red" role="alert">
              {error}
            </p>
            {error === copy.wrongRole && (
              <Link href={copy.otherHref} className="text-sm font-semibold text-primary">
                {copy.otherLabel}
              </Link>
            )}
          </div>
        )}
        <button type="submit" className="btn-primary cursor-pointer" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ios-label-2">
        <Link href="/" className="font-semibold text-primary">
          Volver al inicio
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-ios-label-2">
        ¿Sin cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primary">
          Registrarse
        </Link>
      </p>
    </div>
  );
}
