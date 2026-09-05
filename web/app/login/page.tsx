import Link from "next/link";
import { ZankuLogo } from "@/components/brand/ZankuLogo";

/** Entrada alternativa: misma puerta dual que el home. */
export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="ec-stripe" />
      <div className="mx-auto flex min-h-[calc(100dvh-4px)] w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 text-center">
          <ZankuLogo size={144} priority />
          <h1 className="sr-only">ZANKU</h1>
          <p className="mt-4 text-sm text-muted-fg">Elegí tu puerta</p>
        </div>
        <div className="space-y-2">
          <Link href="/brigada" className="btn-primary">
            App de campo
          </Link>
          <Link href="/jefe" className="btn-secondary">
            Panel de mando
          </Link>
        </div>
        <p className="mt-6 text-center text-sm text-muted-fg">
          <Link href="/" className="font-bold text-accent">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
