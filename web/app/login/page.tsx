import Link from "next/link";

/** Entrada alternativa: misma puerta dual que el home. */
export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="ec-stripe" />
      <div className="mx-auto flex min-h-[calc(100dvh-4px)] w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-white">
            Z
          </div>
          <h1 className="font-heading text-2xl font-bold text-primary">ZANKU</h1>
          <p className="mt-1 text-sm text-muted-fg">Elegí tu puerta</p>
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
