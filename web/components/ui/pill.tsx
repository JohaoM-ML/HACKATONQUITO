import { cn } from "@/lib/utils";

const TONOS = {
  on: "bg-risk-bajo-bg text-risk-bajo",
  off: "bg-muted text-muted-fg",
  alto: "bg-risk-alto-bg text-risk-alto",
  medio: "bg-risk-medio-bg text-risk-medio",
} as const;

export function Pill({
  tono,
  children,
  className,
}: {
  tono: keyof typeof TONOS;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-2.5 py-1 text-center text-[11px] font-bold",
        TONOS[tono],
        className
      )}
    >
      {children}
    </span>
  );
}
