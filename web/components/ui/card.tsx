import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      {children}
    </div>
  );
}

export function CardHead({
  titulo,
  extra,
}: {
  titulo: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-heading text-[15px] font-bold text-fg">{titulo}</h2>
      {extra}
    </div>
  );
}
