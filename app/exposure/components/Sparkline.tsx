"use client";

interface Props {
  data: number[];
  width: number;
  height: number;
  color: string;
  filled?: boolean;
}

export default function Sparkline({ data, width, height, color, filled = false }: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(",").map(Number);
  return (
    <svg width={width} height={height} className="shrink-0">
      {filled && (
        <polygon
          points={`${pad},${height - pad} ${pts.join(" ")} ${width - pad},${height - pad}`}
          fill={color}
          fillOpacity={0.12}
        />
      )}
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} />
    </svg>
  );
}
