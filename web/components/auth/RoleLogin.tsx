"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ZankuLogo } from "@/components/brand/ZankuLogo";
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
    subtitle: "Mis zonas, mapa e inspección en terreno",
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
    <div className="min-h-dvh bg-bg">
      <div className="ec-stripe" />
      <div className="mx-auto flex min-h-[calc(100dvh-4px)] w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 text-center">
          <ZankuLogo size={144} priority />
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted-fg">
            {copy.kicker}
          </p>
          <h1 className="font-heading text-2xl font-bold text-fg">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-fg">{copy.subtitle}</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
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
              <p className="text-sm font-bold text-risk-alto" role="alert">
                {error}
              </p>
              {error === copy.wrongRole && (
                <Link href={copy.otherHref} className="text-sm font-bold text-accent">
                  {copy.otherLabel}
                </Link>
              )}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] text-muted-fg">
          <span className="h-px flex-1 bg-border" />
          demo hackathon
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => entrar(DEMO[rol].email, DEMO[rol].password)}
          className="btn-secondary"
        >
          {copy.demoLabel}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-fg">{DEMO[rol].email}</p>

        <p className="mt-6 text-center text-sm text-muted-fg">
          <Link href="/" className="font-bold text-accent">
            Volver al inicio
          </Link>
          {" · "}
          <Link href="/registro" className="font-bold text-accent">
            Registrarse
          </Link>
        </p>
      </div>
    </div>
  );
}
