"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
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

type ProductSales = {
  produit: string
  ventes: number
}

type AffiliateTop = {
  nom: string
  ventes: number
  commission: number
}

type ProductItem = {
  nom: string
  prix: number
  stock: string
}

type SupplierState = {
  ventesTotales: number
  revenus: number
  affiliesActifs: number
  commissionsAPayer: number
  ventesParProduit: ProductSales[]
  topAffilies: AffiliateTop[]
  produits: ProductItem[]
}

const initialState: SupplierState = {
  ventesTotales: 1248,
  revenus: 45780,
  affiliesActifs: 38,
  commissionsAPayer: 6250,
  ventesParProduit: [
    { produit: "Formation Ads Pro", ventes: 410 },
    { produit: "Template Tunnel SaaS", ventes: 320 },
    { produit: "Pack Creatifs Meta", ventes: 265 },
    { produit: "Guide Emailing B2B", ventes: 180 },
    { produit: "Bundle Notion Sales", ventes: 125 },
  ],
  topAffilies: [
    { nom: "Lea Martin", ventes: 145, commission: 1880 },
    { nom: "Sofiane Kh", ventes: 132, commission: 1710 },
    { nom: "Maya T.", ventes: 118, commission: 1530 },
    { nom: "Nina Dubois", ventes: 96, commission: 1290 },
  ],
  produits: [
    { nom: "Formation Ads Pro", prix: 149, stock: "Illimite (digital)" },
    { nom: "Template Tunnel SaaS", prix: 99, stock: "Illimite (digital)" },
    { nom: "Pack Creatifs Meta", prix: 79, stock: "Illimite (digital)" },
    { nom: "Guide Emailing B2B", prix: 49, stock: "Illimite (digital)" },
  ],
}

function vary(value: number, ratio = 0.05): number {
  const delta = value * ratio
  const next = value + (Math.random() * 2 - 1) * delta
  return Math.max(1, Math.round(next))
}

export function FournisseurLiveDashboard({ user }: { user: DashboardUser }) {
  const [state, setState] = useState<SupplierState>(initialState)

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => ({
        ...prev,
        ventesTotales: vary(prev.ventesTotales),
        revenus: vary(prev.revenus),
        affiliesActifs: vary(prev.affiliesActifs),
        commissionsAPayer: vary(prev.commissionsAPayer),
        ventesParProduit: prev.ventesParProduit.map((item) => ({
          ...item,
          ventes: vary(item.ventes),
        })),
        topAffilies: prev.topAffilies.map((item) => ({
          ...item,
          ventes: vary(item.ventes),
          commission: vary(item.commission),
        })),
      }))
    }, 3000)

    return () => clearInterval(id)
  }, [])

  const panierMoyen = useMemo(() => {
    if (state.ventesTotales === 0) return "0 EUR"
    return `${Math.round(state.revenus / state.ventesTotales).toLocaleString("fr-FR")} EUR`
  }, [state.revenus, state.ventesTotales])

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 text-zinc-900 md:p-10 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <section className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Dashboard fournisseur - Donnees mock en temps reel (3s)
          </p>
          <h1 className="text-3xl font-semibold">Bonjour {user.name ?? "Fournisseur"}</h1>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Ventes totales" value={state.ventesTotales.toLocaleString("fr-FR")} />
          <KpiCard label="Revenus" value={`${state.revenus.toLocaleString("fr-FR")} EUR`} />
          <KpiCard label="Affilies actifs" value={state.affiliesActifs.toLocaleString("fr-FR")} />
          <KpiCard label="Commissions a payer" value={`${state.commissionsAPayer.toLocaleString("fr-FR")} EUR`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Ventes par produit</h2>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Vue live de la distribution des ventes.
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={state.ventesParProduit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                  <XAxis dataKey="produit" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={65} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [
                      Number(value ?? 0).toLocaleString("fr-FR"),
                      "Ventes",
                    ]}
                  />
                  <Bar dataKey="ventes" fill="#18181b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Indicateurs rapides</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Panier moyen</span>
                <strong>{panierMoyen}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Marge estimee</span>
                <strong>{Math.round(state.revenus * 0.42).toLocaleString("fr-FR")} EUR</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Taux activation affilies</span>
                <strong>{Math.min(100, Math.round((state.affiliesActifs / 50) * 100))}%</strong>
              </li>
            </ul>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-lg font-semibold">Top affilies</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-2 pr-4">Affilie</th>
                    <th className="py-2 pr-4">Ventes</th>
                    <th className="py-2">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {state.topAffilies.map((row) => (
                    <tr key={row.nom} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-4">{row.nom}</td>
                      <td className="py-2 pr-4">{row.ventes.toLocaleString("fr-FR")}</td>
                      <td className="py-2 font-medium">{row.commission.toLocaleString("fr-FR")} EUR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-lg font-semibold">Mes produits</h2>
            <ul className="space-y-2 text-sm">
              {state.produits.map((p) => (
                <li key={p.nom} className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <p className="font-medium">{p.nom}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {p.prix.toLocaleString("fr-FR")} EUR - {p.stock}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
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
