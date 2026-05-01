"use client"

import { useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Props = {
  user: { id: string; name?: string | null; email?: string | null }
  kpis: {
    commissionsMois: number
    clics: number
    conversions: number
    taux: number
  }
  revenus30j: { day: string; revenus: number }[]
  ventesRecentes: { date: string; produit: string; commission: number }[]
  products: MarketProduct[]
}

type MarketProduct = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  commissionPercent: number
  supplier: { name: string | null; email: string }
}

export function AffiliateLiveDashboard({
  user,
  kpis,
  revenus30j,
  ventesRecentes,
  products,
}: Props) {
  const [toast, setToast] = useState<string | null>(null)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  async function copyAffiliateLink(productId: string) {
    const link = `${baseUrl}/p/${productId}?ref=${user.id}`
    await navigator.clipboard.writeText(link)
    setToast("Lien copié")
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white p-6 text-zinc-900 md:p-10 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Dashboard affilie - Donnees reelles
            </p>
            <h1 className="text-3xl font-semibold">Bonjour {user.name ?? "Affilie"}</h1>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">Mon lien d'affiliation</p>
            <code className="mt-1 block rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
              {`${baseUrl}/p/<id>?ref=${user.id}`}
            </code>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Commissions ce mois" value={`${kpis.commissionsMois.toLocaleString("fr-FR")} EUR`} />
          <KpiCard label="Clics" value={kpis.clics.toLocaleString("fr-FR")} />
          <KpiCard label="Conversions" value={kpis.conversions.toLocaleString("fr-FR")} />
          <KpiCard label="Taux" value={`${kpis.taux.toFixed(2)}%`} />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Revenus 30 jours</h2>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Commissions calculees depuis vos ventes affiliees.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenus30j}>
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
          <h2 className="mb-3 text-lg font-semibold">Marketplace</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <article key={p.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {p.description || "Sans description"}
                </p>
                <p className="mt-2 text-sm">
                  {(p.price / 100).toLocaleString("fr-FR")} EUR - commission {p.commissionPercent}%
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Fournisseur : {p.supplier.name || p.supplier.email}
                </p>
                <button
                  type="button"
                  onClick={() => copyAffiliateLink(p.id)}
                  className="mt-3 rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Copier mon lien
                </button>
              </article>
            ))}
          </div>
        </section>
        {toast ? (
          <div className="fixed bottom-6 right-6 rounded-md bg-black px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        ) : null}

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
                {ventesRecentes.map((row) => (
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
