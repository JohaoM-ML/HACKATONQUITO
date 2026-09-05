"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, Map, Route, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/types";
import { LivePill } from "@/components/ui/page-header";

const NAV = [
  { href: "/panel", label: "Resumen", short: "Resumen", icon: BarChart3 },
  { href: "/mapa", label: "Mapa de riesgo", short: "Mapa", icon: Map },
  { href: "/cola", label: "Cola priorizada", short: "Cola", icon: Route },
  { href: "/equipo", label: "Brigada", short: "Brigada", icon: Users },
  { href: "/avisos", label: "Alertas", short: "Alertas", icon: Bell },
];

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Shell de escritorio para el jefe (institucional claro). */
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
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-bg">
      <div className="ec-stripe" />

      <div className="flex min-h-[calc(100dvh-4px)]">
        <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-card px-3 py-5 lg:flex">
          <div className="flex items-center gap-2.5 px-2 pb-6 pt-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-white">
              Z
            </div>
            <div>
              <b className="block font-heading text-[13px] font-bold tracking-wide text-fg">
                ZANKU
              </b>
              <span className="block text-[11px] text-muted-fg">Panel de mando</span>
            </div>
          </div>

          <nav className="flex flex-col gap-0.5" aria-label="Navegación mando">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-bold transition",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-fg hover:bg-muted hover:text-fg"
                  )}
                >
                  <Icon size={18} strokeWidth={2} className="shrink-0" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 border-t border-border px-2 pt-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-heading text-[13px] font-bold text-primary">
                {iniciales(perfil.nombre)}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[12.5px] font-bold text-fg">{perfil.nombre}</b>
                <span className="block text-[11px] text-muted-fg">Jefe de brigada</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="cursor-pointer text-[11px] font-bold text-muted-fg hover:text-fg"
              >
                Salir
              </button>
            </div>
          </div>
        </aside>

        <nav
          className="fixed bottom-0 left-0 z-30 flex w-full border-t border-border bg-card/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: "var(--safe-b)" }}
          aria-label="Navegación mando móvil"
        >
          {NAV.map(({ href, label, short, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  "flex min-h-[var(--tab-h)] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-bold",
                  active ? "text-primary" : "text-muted-fg"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden />
                <span className="truncate">{short}</span>
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 px-4 pb-[calc(var(--tab-h)+24px)] pt-5 sm:px-6 lg:px-8 lg:pb-12">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-[22px] font-bold text-fg">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-muted-fg">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={logout}
                className="cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-muted-fg lg:hidden"
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

export { LivePill };
