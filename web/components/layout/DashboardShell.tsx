"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Route, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Perfil } from "@/types";
import { createClient } from "@/lib/supabase/client";

const NAV_BRIG = [
  { href: "/ruta", label: "Mis zonas", icon: Route },
  { href: "/mis-registros", label: "Registros", icon: ClipboardList },
  { href: "/perfil", label: "Perfil", icon: Settings },
];

/** Shell móvil-first para brigadista (columna institucional, sin mockup iPhone). */
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

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-field flex-col bg-bg">
      <div className="ec-stripe" />
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">
            Campo · {perfil.rol}
          </p>
          <h1 className="font-heading text-lg font-bold text-fg">{title}</h1>
        </div>
        <button
          type="button"
          onClick={logout}
          className="cursor-pointer rounded-lg px-2 py-2 text-xs font-bold text-muted-fg hover:text-fg"
        >
          Salir
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-[calc(var(--tab-h)+var(--safe-b)+12px)] pt-4">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-field -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "var(--safe-b)" }}
        aria-label="Navegación campo"
      >
        {NAV_BRIG.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[var(--tab-h)] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-bold",
                active ? "text-primary" : "text-muted-fg"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
