import { cn } from "@/lib/utils";

const ACENTO = {
  blue: "bg-primary",
  gold: "bg-accent",
  green: "bg-risk-bajo",
  red: "bg-risk-alto",
} as const;

export function KpiCard({
  color,
  label,
  valor,
  nota,
  className,
}: {
  color: keyof typeof ACENTO;
  label: string;
  valor: React.ReactNode;
  nota?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card px-3.5 pb-3 pt-3.5",
        className
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-0.5", ACENTO[color])} aria-hidden />
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">{label}</p>
      <p className="mt-1.5 font-heading text-[26px] font-bold leading-none text-fg">{valor}</p>
      {nota && <p className="mt-1.5 text-xs leading-snug text-muted-fg">{nota}</p>}
    </div>
  );
}

export function Progreso({ pct, className }: { pct: number; className?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const color = p >= 100 ? "bg-risk-bajo" : p > 0 ? "bg-accent" : "bg-risk-alto";
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded transition-all", color)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Avatar({
  texto,
  tono = "neutro",
}: {
  texto: string;
  tono?: "neutro" | "alto" | "medio";
}) {
  const clases = {
    neutro: "bg-muted text-fg",
    alto: "bg-risk-alto-bg text-risk-alto",
    medio: "bg-risk-medio-bg text-risk-medio",
  }[tono];
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold",
        clases
      )}
    >
      {texto}
    </span>
  );
}
