import { cn } from "@/lib/utils";

export function Chip({
  active,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn("chip text-center", active && "chip-active", className)}
      {...props}
    >
      {children}
    </button>
  );
}
