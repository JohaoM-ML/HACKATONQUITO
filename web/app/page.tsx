import Link from "next/link";
import { Hexagon, LayoutDashboard } from "lucide-react";

const PUERTAS = [
  {
    href: "/brigada",
    kicker: "Brigadista",
    title: "App de campo",
    subtitle: "Mis zonas, mapa de hexágonos, inspección",
    icon: Hexagon,
  },
  {
    href: "/jefe",
    kicker: "Jefe",
    title: "Panel de mando",
    subtitle: "Resumen, mapa de riesgo, cola, equipo",
    icon: LayoutDashboard,
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-ios-bg">
      <div className="h-1.5 bg-gradient-to-r from-ec-yellow via-ec-blue to-ec-red" />
      <main className="mx-auto flex min-h-[calc(100dvh-6px)] w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
        <header className="mb-8 text-center sm:mb-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ec-blue to-primary font-heading text-lg font-bold text-white">
            VS
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            VENTANA SECA
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ios-label-2 sm:text-base">
            Elegí tu puerta. Una sola app, dos entradas.
          </p>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {PUERTAS.map(({ href, kicker, title, subtitle, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="card flex min-h-[168px] cursor-pointer flex-col justify-between border border-ios-sep p-5 transition duration-200 hover:border-primary/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-[200px] sm:p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="mt-5">
                  <p className="font-heading text-[11px] font-semibold uppercase tracking-wide text-ios-label-3">
                    {kicker}
                  </p>
                  <h2 className="mt-1 font-heading text-xl font-bold text-ios-label">{title}</h2>
                  <p className="mt-1.5 text-sm leading-snug text-ios-label-2">{subtitle}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
