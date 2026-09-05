"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  Map,
  MessageCircle,
  Route,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Perfil } from "@/types";
import { createClient } from "@/lib/supabase/client";

const NAV_BRIG = [
  { href: "/ruta", label: "Mis zonas", icon: Route },
  { href: "/mis-registros", label: "Registros", icon: ClipboardList },
  { href: "/perfil", label: "Perfil", icon: Settings },
];

const NAV_JEFE = [
  { href: "/panel", label: "Panel", icon: LayoutDashboard },
  { href: "/mapa", label: "Mapa", icon: Map },
  { href: "/cola", label: "Cola", icon: Route },
  { href: "/equipo", label: "Equipo", icon: Users },
  { href: "/avisos", label: "Avisos", icon: MessageCircle },
];

export function DashboardShell({
  perfil,
  title,
  children,
}: {
  perfil: Perfil;
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = perfil.rol === "jefe" ? NAV_JEFE : NAV_BRIG;

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function irAMando() {
    await createClient().auth.signOut();
    router.push("/jefe");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col bg-ios-bg shadow-2xl sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[32px] sm:overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-ec-yellow via-ec-blue to-ec-red" />
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ios-sep bg-ios-bg/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="font-heading text-[11px] font-semibold uppercase tracking-wide text-ios-label-3">
            Ventana Seca · {perfil.rol}
          </p>
          <h1 className="font-heading text-lg font-bold text-ios-label">{title}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          {perfil.rol === "brigadista" && (
            <button
              type="button"
              onClick={irAMando}
              className="cursor-pointer text-[11px] font-semibold text-primary"
            >
              Cambiar a panel de mando
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-ios-label-2"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-[calc(var(--tab-h)+var(--safe-b)+12px)] pt-4">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-phone -translate-x-1/2 border-t border-ios-sep bg-white/95 backdrop-blur"
        style={{ paddingBottom: "var(--safe-b)" }}
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[var(--tab-h)] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                active ? "text-primary" : "text-ios-label-3"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
