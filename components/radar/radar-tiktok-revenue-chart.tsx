"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Point = { date: string; revenue: number; orders: number }

function formatDay(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

export default function RadarTikTokRevenueChart({
  data,
  currency,
}: {
  data: Point[]
  currency: string
}) {
  const chartData = data.map((p) => ({
    ...p,
    label: formatDay(p.date),
  }))

  if (chartData.length === 0) {
    return <p className="mt-4 text-sm text-zinc-500">Pas encore de CA journalier.</p>
  }

  return (
    <div className="mt-4 h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            width={48}
            tickFormatter={(v: number) =>
              new Intl.NumberFormat("fr-FR", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(v)
            }
          />
          <Tooltip
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value)
              try {
                return [
                  new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: currency.length === 3 ? currency : "USD",
                  }).format(Number.isFinite(n) ? n : 0),
                  "CA",
                ]
              } catch {
                return [String(value), "CA"]
              }
            }}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { date?: string } | undefined
              return row?.date ?? ""
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
