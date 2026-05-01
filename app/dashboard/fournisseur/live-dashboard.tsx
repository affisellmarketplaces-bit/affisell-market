"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type ProductRow = {
  id: string
  name: string
  price: number
  active: boolean
  imageUrl: string | null
}

type Props = {
  user: { id: string; name?: string | null; email?: string | null }
  kpis: {
    ventesTotales: number
    revenus: number
    affiliesActifs: number
    commissionsAPayer: number
  }
  salesByProduct: { produit: string; ventes: number }[]
  topAffiliates: { nom: string; ventes: number; commission: number }[]
  products: ProductRow[]
}

export function FournisseurLiveDashboard({
  user,
  kpis,
  salesByProduct,
  topAffiliates,
  products,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const panierMoyen = useMemo(() => {
    if (kpis.ventesTotales === 0) return "0 EUR"
    return `${Math.round(kpis.revenus / kpis.ventesTotales).toLocaleString("fr-FR")} EUR`
  }, [kpis.revenus, kpis.ventesTotales])

  async function onCreateProduct(formData: FormData) {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: String(formData.get("name") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        price: Math.round(Number(formData.get("price") || 0) * 100),
        commissionPercent: Number(formData.get("commissionPercent") || 30),
        imageUrl: String(formData.get("imageUrl") || "").trim(),
      }
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error || "Creation impossible")
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  async function toggleProduct(id: string, active: boolean) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error || "Mise a jour impossible")
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 text-zinc-900 md:p-10 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <section className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Dashboard fournisseur - Donnees Prisma en temps reel
          </p>
          <h1 className="text-3xl font-semibold">Bonjour {user.name ?? "Fournisseur"}</h1>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">Nouveau produit</h2>
          <form action={onCreateProduct} className="grid gap-3 md:grid-cols-2">
            <input name="name" required placeholder="Nom du produit" className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <input name="price" required type="number" min="1" step="0.01" placeholder="Prix EUR" className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <input name="commissionPercent" type="number" min="1" max="90" defaultValue={30} placeholder="Commission %" className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <input name="imageUrl" placeholder="URL image" className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <textarea name="description" placeholder="Description" className="md:col-span-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <button disabled={saving} className="md:col-span-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
              {saving ? "Enregistrement..." : "Ajouter le produit"}
            </button>
          </form>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Ventes totales" value={kpis.ventesTotales.toLocaleString("fr-FR")} />
          <KpiCard label="Revenus" value={`${kpis.revenus.toLocaleString("fr-FR")} EUR`} />
          <KpiCard label="Affilies actifs" value={kpis.affiliesActifs.toLocaleString("fr-FR")} />
          <KpiCard label="Commissions a payer" value={`${kpis.commissionsAPayer.toLocaleString("fr-FR")} EUR`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Ventes par produit</h2>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              Distribution des commandes reliees a vos produits.
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByProduct}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                  <XAxis dataKey="produit" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={65} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [Number(value ?? 0).toLocaleString("fr-FR"), "Ventes"]} />
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
                <strong>{Math.round(kpis.revenus * 0.42).toLocaleString("fr-FR")} EUR</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Produits actifs</span>
                <strong>{products.filter((p) => p.active).length}</strong>
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
                  {topAffiliates.map((row) => (
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
              {products.map((p) => (
                <li key={p.id} className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        {(p.price / 100).toLocaleString("fr-FR")} EUR - {p.active ? "Actif" : "Inactif"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleProduct(p.id, p.active)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      {p.active ? "Desactiver" : "Activer"}
                    </button>
                  </div>
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
