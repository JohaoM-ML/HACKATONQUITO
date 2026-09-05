"use client";

export type PuntoSerie = { etiqueta: string; valor: number; detalle?: string };

/**
 * Gráfico de área en SVG puro, con la misma estética del mockup.
 * Sin librería de charts: son 8–14 puntos y no justifica el peso de una dependencia.
 */
export function GraficoArea({ datos }: { datos: PuntoSerie[] }) {
  const W = 560;
  const H = 190;
  const padX = 30;
  const topY = 30;
  const botY = 150;

  if (datos.length < 2) {
    return (
      <div className="flex h-[190px] items-center justify-center text-sm text-muted-fg">
        Aún no hay suficientes días con registros para dibujar la tendencia.
      </div>
    );
  }

  const max = Math.max(...datos.map((d) => d.valor), 1);
  const step = (W - padX * 2) / (datos.length - 1);
  const puntos = datos.map((d, i) => ({
    ...d,
    x: padX + i * step,
    y: botY - (d.valor / max) * (botY - topY),
  }));

  const linea = puntos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
  const area = `M${linea} L${puntos.at(-1)!.x.toFixed(1)},${botY} L${puntos[0].x.toFixed(1)},${botY} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
      <defs>
        <linearGradient id="fadeArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1E40AF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[topY, (topY + botY) / 2, botY].map((y) => (
        <line key={y} x1={padX - 10} y1={y} x2={W - 15} y2={y} stroke="#E2E8F0" strokeWidth={1} />
      ))}

      <path d={area} fill="url(#fadeArea)" />
      <path
        d={`M${linea}`}
        fill="none"
        stroke="#1E40AF"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {puntos.map((p) => (
        <g key={p.etiqueta}>
          <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#1E40AF" strokeWidth={2.5}>
            <title>{p.detalle ?? `${p.etiqueta}: ${p.valor}`}</title>
          </circle>
          <text x={p.x} y={botY + 22} textAnchor="middle" fontSize={10} fill="#475569">
            {p.etiqueta}
          </text>
        </g>
      ))}
    </svg>
  );
}
