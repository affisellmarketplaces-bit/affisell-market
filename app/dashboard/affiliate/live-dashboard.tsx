"use client"

import { useMemo, useState } from "react"
import { useEffect } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type DashboardUser = {
  name?: string | null
  email?: string | null
}

type RevenuePoint = {
  day: string
  revenus: number
}

type SaleRow = {
  date: string
  produit: string
  commission: number
}

type AffiliateState = {
  commissionsMois: number
  clics: number
  conversions: number
  revenus30j: RevenuePoint[]
  ventesRecentes: SaleRow[]
}

const baseRevenus30j: RevenuePoint[] = Array.from({ length: 30 }, (_, i) => ({
  day: `${i + 1}`,
  revenus: 25 + Math.round(Math.random() * 70),
}))

const baseVentesRecentes: SaleRow[] = [
  { date: "01/05/2026", produit: "Formation Ads Pro", commission: 42 },
  { date: "01/05/2026", produit: "Template Tunnel SaaS", commission: 27 },
  { date: "30/04/2026", produit: "Pack Creatifs Meta", commission: 31 },
  { date: "30/04/2026", produit: "Guide Emailing B2B", commission: 18 },
  { date: "29/04/2026", produit: "Bundle Notion Sales", commission: 24 },
]

function vary(value: number, ratio = 0.05): number {
  const delta = value * ratio
  const next = value + (Math.random() * 2 - 1) * delta
  return Math.max(1, Math.round(next))
}

export function AffiliateLiveDashboard({ user }: { user: DashboardUser }) {
  const [state, setState] = useState<AffiliateState>({
    commissionsMois: 2840,
    clics: 18250,
    conversions: 456,
    revenus30j: baseRevenus30j,
    ventesRecentes: baseVentesRecentes,
  })

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => ({
        ...prev,
        commissionsMois: vary(prev.commissionsMois),
        clics: vary(prev.clics),
        conversions: vary(prev.conversions),
        revenus30j: prev.revenus30j.map((item) => ({
          ...item,
          revenus: vary(item.revenus),
        })),
        ventesRecentes: prev.ventesRecentes.map((row) => ({
          ...row,
          commission: vary(row.commission),
        })),
      }))
    }, 3000)

    return () => clearInterval(id)
  }, [])

  const taux = useMemo(() => {
    return ((state.conversions / state.clics) * 100).toFixed(2)
  }, [state.clics, state.conversions])

  const lienAffiliation = "https://affisell.market/ref/affilie-demo"

  async function copyLink() {
    await navigator.clipboard.writeText(lienAffiliation)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white p-6 text-zinc-900 md:p-10 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Dashboard affilié - Mise a jour toutes les 3s
            </p>
            <h1 className="text-3xl font-semibold">Bonjour {user.name ?? "Affilie"}</h1>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">Mon lien d'affiliation</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                {lienAffiliation}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Copier
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Commissions ce mois" value={`${state.commissionsMois.toLocaleString("fr-FR")} EUR`} />
          <KpiCard label="Clics" value={state.clics.toLocaleString("fr-FR")} />
          <KpiCard label="Conversions" value={state.conversions.toLocaleString("fr-FR")} />
          <KpiCard label="Taux" value={`${taux}%`} />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Revenus 30 jours</h2>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Simulation live des commissions journalieres.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.revenus30j}>
                <defs>
                  <linearGradient id="affRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value ?? 0).toLocaleString("fr-FR")} EUR`,
                    "Revenus",
                  ]}
                />
                <Area type="monotone" dataKey="revenus" stroke="#18181b" fill="url(#affRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">Ventes recentes</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Produit</th>
                  <th className="py-2">Commission</th>
                </tr>
              </thead>
              <tbody>
                {state.ventesRecentes.map((row) => (
                  <tr key={`${row.date}-${row.produit}`} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-4">{row.date}</td>
                    <td className="py-2 pr-4">{row.produit}</td>
                    <td className="py-2 font-medium">{row.commission.toLocaleString("fr-FR")} EUR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  )
}
