import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {kicker && (
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-fg">{kicker}</p>
        )}
        <h1 className="font-heading text-[22px] font-bold leading-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-fg">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function LivePill({ texto }: { texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-muted-fg">
      <span
        className="h-1.5 w-1.5 rounded-full bg-risk-bajo motion-safe:animate-pulse"
        aria-hidden
      />
      {texto}
    </span>
  );
}
