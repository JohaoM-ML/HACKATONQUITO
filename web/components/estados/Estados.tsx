import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function EstadoCargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ios-label-2">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm font-medium">{texto}</p>
    </div>
  );
}

export function EstadoError({ mensaje }: { mensaje: string }) {
  return (
    <div className="card flex items-start gap-3 border border-ios-red/20 bg-red-50">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-ios-red" />
      <p className="text-sm text-ios-label">{mensaje}</p>
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
      <Inbox className="h-10 w-10 text-ios-label-3" />
      <p className="font-heading font-semibold text-ios-label">{titulo}</p>
      {descripcion && <p className="max-w-xs text-sm text-ios-label-2">{descripcion}</p>}
    </div>
  );
}
