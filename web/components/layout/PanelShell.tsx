"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, Map, Route, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/types";

const NAV = [
  { href: "/panel", label: "Resumen", icon: BarChart3 },
  { href: "/mapa", label: "Mapa de riesgo", icon: Map },
  { href: "/cola", label: "Cola priorizada", icon: Route },
  { href: "/equipo", label: "Brigada", icon: Users },
  { href: "/avisos", label: "Alertas", icon: Bell },
];

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Shell de escritorio para el jefe. El brigadista sigue con DashboardShell (móvil). */
export function PanelShell({
  perfil,
  title,
  subtitle,
  actions,
  children,
}: {
  perfil: Perfil;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function irACampo() {
    await createClient().auth.signOut();
    router.push("/brigada");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-ios-bg">
      <div className="h-[5px] bg-gradient-to-r from-ec-yellow via-ec-blue to-ec-red" />

      <div className="flex items-center justify-between gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2.5 lg:px-8">
        <p className="text-[12.5px] font-semibold text-ios-label">
          Estás en la app del <span className="text-accent">jefe</span> (Resumen / Mapa).
          Las minizonas de campo están en la del brigadista.
        </p>
        <button
          type="button"
          onClick={irACampo}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-white"
        >
          Ir a app de campo
        </button>
      </div>

      <div className="flex min-h-[calc(100dvh-5px-44px)]">
        <aside className="hidden w-[230px] shrink-0 flex-col bg-ios-label px-3.5 py-5 text-white lg:flex">
          <div className="flex items-center gap-2.5 px-2 pb-6 pt-1">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-ec-blue to-primary font-heading text-sm font-bold">
              VS
            </div>
            <div>
              <b className="block font-heading text-[13px] font-bold tracking-wide">VENTANA SECA</b>
              <span className="block text-[11px] text-[#9FB0CC]">Panel Jefe</span>
            </div>
          </div>

          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold transition",
                    active
                      ? "bg-white/[.12] text-white"
                      : "text-[#B7C3DA] hover:bg-white/[.06]"
                  )}
                >
                  <Icon size={18} strokeWidth={2} className="shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 border-t border-white/[.12] px-2 pt-3">
            <button
              type="button"
              onClick={irACampo}
              className="w-full rounded-lg bg-white/15 py-2 text-[12px] font-bold text-white hover:bg-white/25"
            >
              Ir a app de campo
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-accent font-heading text-[13px] font-bold">
                {iniciales(perfil.nombre)}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[12.5px] font-semibold">{perfil.nombre}</b>
                <span className="block text-[11px] text-[#9FB0CC]">Jefe de brigada</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-[11px] font-semibold text-[#9FB0CC] hover:text-white"
              >
                Salir
              </button>
            </div>
          </div>
        </aside>

        {/* Nav horizontal para pantallas chicas: el jefe a veces abre el panel desde el teléfono */}
        <nav className="fixed bottom-0 left-0 z-30 flex w-full border-t border-ios-sep bg-white/95 backdrop-blur lg:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-[var(--tab-h)] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold",
                  active ? "text-primary" : "text-ios-label-3"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                {label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 px-5 pb-[calc(var(--tab-h)+24px)] pt-6 lg:px-8 lg:pb-14">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-[22px] font-bold text-ios-label">{title}</h1>
              {subtitle && <p className="mt-0.5 text-[12.5px] text-ios-label-2">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-ios-sep bg-white px-3 py-2 text-[12px] font-semibold text-ios-label-2 lg:hidden"
              >
                Salir
              </button>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Píldora "en vivo" del mockup, reutilizada en Resumen y Alertas. */
export function LivePill({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-[7px] rounded-full border border-ios-sep bg-white py-[7px] pl-2.5 pr-3.5 text-xs font-semibold text-ios-label-2 shadow-sm">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-risk-bajo" />
      {texto}
    </div>
  );
}
