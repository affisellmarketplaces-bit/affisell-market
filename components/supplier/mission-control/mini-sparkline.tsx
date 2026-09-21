type Props = {
  values: number[]
  className?: string
  /** Unique per instance on the page (SVG gradient id). */
  id: string
  stroke?: string
}

/** Pure-SVG sparkline (server-renderable, no chart library). Flat dashed line when there is no data yet. */
export function MiniSparkline({ values, className, id, stroke = "#059669" }: Props) {
  const w = 120
  const h = 36
  const pad = 3
  const max = Math.max(0, ...values)
  const n = values.length

  if (n < 2 || max <= 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden preserveAspectRatio="none">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 4" strokeWidth="1.5" />
      </svg>
    )
  }

  const x = (i: number) => pad + (i * (w - pad * 2)) / (n - 1)
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2)
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const area = `${line} L${x(n - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(values[n - 1]!)} r="2.2" fill={stroke} />
    </svg>
  )
}
