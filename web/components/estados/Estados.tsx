import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function EstadoCargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-fg">
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-bold">{texto}</p>
    </div>
  );
}

export function EstadoError({ mensaje }: { mensaje: string }) {
  return (
    <div
      className="card flex items-start gap-3 border-risk-alto/30 bg-risk-alto-bg"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-risk-alto" aria-hidden />
      <p className="text-sm font-bold text-fg">{mensaje}</p>
    </div>
  );
}

export function EstadoVacio({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Inbox className="h-9 w-9 text-muted-fg" aria-hidden />
      <p className="font-heading font-bold text-fg">{titulo}</p>
      {descripcion && <p className="max-w-sm text-sm text-muted-fg">{descripcion}</p>}
    </div>
  );
}
