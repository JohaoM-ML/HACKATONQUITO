"use client";

import { cn } from "@/lib/utils";

const ACENTO = {
  blue: "bg-primary",
  gold: "bg-accent",
  green: "bg-risk-bajo",
  red: "bg-risk-alto",
} as const;

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ios-sep bg-white p-[18px] shadow-[0_2px_10px_rgba(15,23,42,.05)]",
        className
      )}
    >
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
    <div className="mb-3.5 flex items-baseline justify-between gap-3">
      <h2 className="font-heading text-[15px] font-bold text-ios-label">{titulo}</h2>
      {extra}
    </div>
  );
}

export function KpiCard({
  color,
  label,
  valor,
  nota,
}: {
  color: keyof typeof ACENTO;
  label: string;
  valor: React.ReactNode;
  nota?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ios-sep bg-white px-4 pb-3.5 pt-4 shadow-[0_2px_10px_rgba(15,23,42,.05)]">
      <span className={cn("absolute inset-x-0 top-0 h-1", ACENTO[color])} />
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ios-label-2">
        {label}
      </p>
      <p className="mt-2 font-heading text-[28px] font-bold leading-none text-ios-label">{valor}</p>
      {nota && <p className="mt-2 text-xs leading-snug text-ios-label-2">{nota}</p>}
    </div>
  );
}

/** Barra de progreso con el mismo código de color del mockup. */
export function Progreso({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const color = p >= 100 ? "bg-risk-bajo" : p > 0 ? "bg-accent" : "bg-risk-alto";
  return (
    <div className="h-[7px] overflow-hidden rounded bg-ios-fill">
      <div className={cn("h-full rounded transition-all", color)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Pill({
  tono,
  children,
}: {
  tono: "on" | "off" | "alto" | "medio";
  children: React.ReactNode;
}) {
  const clases = {
    on: "bg-risk-bajo-bg text-risk-bajo",
    off: "bg-ios-fill text-ios-label-2",
    alto: "bg-risk-alto-bg text-risk-alto",
    medio: "bg-risk-medio-bg text-risk-medio",
  }[tono];
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2.5 py-1 text-center text-[10.5px] font-bold",
        clases
      )}
    >
      {children}
    </span>
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
    neutro: "bg-ios-fill text-ios-label",
    alto: "bg-risk-alto-bg text-risk-alto",
    medio: "bg-risk-medio-bg text-risk-medio",
  }[tono];
  return (
    <span
      className={cn(
        "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] font-heading text-sm font-semibold",
        clases
      )}
    >
      {texto}
    </span>
  );
}
