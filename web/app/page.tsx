import Link from "next/link";
import { Hexagon, LayoutDashboard } from "lucide-react";
import { ZankuLogo } from "@/components/brand/ZankuLogo";

const PUERTAS = [
  {
    href: "/brigada",
    kicker: "Brigadista",
    title: "App de campo",
    subtitle: "Ruta del día, minizonas e inspección en terreno.",
    cta: "Entrar a campo",
    icon: Hexagon,
  },
  {
    href: "/jefe",
    kicker: "Jefe de brigada",
    title: "Panel de mando",
    subtitle: "Resumen, mapa de riesgo, cola y alertas WhatsApp.",
    cta: "Entrar a mando",
    icon: LayoutDashboard,
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="ec-stripe" />
      <main className="mx-auto flex min-h-[calc(100dvh-4px)] w-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
        <header className="mb-8 text-center sm:mb-10">
          <ZankuLogo size={160} priority />
          <h1 className="sr-only">ZANKU</h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-fg sm:text-base">
            Operaciones antidengue a partir de cortes de agua. Elegí tu puerta.
          </p>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {PUERTAS.map(({ href, kicker, title, subtitle, cta, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="card flex min-h-[180px] cursor-pointer flex-col justify-between p-5 transition duration-200 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-[200px] sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon size={22} strokeWidth={2} aria-hidden />
                </div>
                <div className="mt-5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">
                    {kicker}
                  </p>
                  <h2 className="mt-1 font-heading text-xl font-bold text-fg">{title}</h2>
                  <p className="mt-1.5 text-sm leading-snug text-muted-fg">{subtitle}</p>
                  <span className="mt-4 inline-block text-sm font-bold text-accent">{cta} →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="mt-10 text-center text-xs text-muted-fg">
          <p>Herramienta operativa · Guayaquil · Los vecinos reciben avisos por WhatsApp</p>
          <p className="mt-2">
            <Link href="/aviso" className="font-bold text-accent hover:underline">
              Ver avisos al ciudadano
            </Link>
            <span> · no requiere cuenta</span>
          </p>
          <p className="mt-2">
            <Link href="/registro" className="font-bold text-accent hover:underline">
              Crear cuenta
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
