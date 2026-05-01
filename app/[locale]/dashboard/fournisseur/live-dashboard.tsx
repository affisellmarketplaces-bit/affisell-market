"use client"

import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
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

type ProductRow = {
  id: string
  name: string
  priceCents: number
  active: boolean
  image: string | null
  stock: number
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
  const locale = useLocale()
  const t = useTranslations("supplier")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState(products)

  useEffect(() => {
    setMine(products)
  }, [products])

  const panierMoyen = useMemo(() => {
    if (kpis.ventesTotales === 0) return `0 EUR`
    return `${Math.round(kpis.revenus / kpis.ventesTotales).toLocaleString(locale)} EUR`
  }, [kpis.revenus, kpis.ventesTotales, locale])

  async function refreshMyProductsFromApi() {
    const resList = await fetch("/api/products", { cache: "no-store" })
    if (!resList.ok) return
    const data = (await resList.json()) as ProductRow[]
    if (Array.isArray(data)) setMine(data)
  }

  async function onCreateProduct(formData: FormData) {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: String(formData.get("name") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        price: Math.round(Number(formData.get("price") || 0) * 100),
        commissionPercent: Number(formData.get("commissionPercent") || 30),
        image: String(formData.get("image") || "").trim(),
        stock: Math.round(Number(formData.get("stock") || 999)),
      }
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error || t("createFailed"))
      }
      await refreshMyProductsFromApi()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorUnknown"))
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
        throw new Error(data.error || t("updateFailed"))
      }
      await refreshMyProductsFromApi()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorUnknown"))
    } finally {
      setSaving(false)
    }
  }

  function formatEurCents(value: number) {
    return (value / 100).toLocaleString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", {
      style: "currency",
      currency: "EUR",
    })
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 text-zinc-900 md:p-10 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <section className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("dashboardTagline")}</p>
          <h1 className="text-3xl font-semibold">
            {t("hello")} {user.name ?? user.email ?? t("guestName")}
          </h1>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">{t("newProductTitle")}</h2>
          <form action={onCreateProduct} className="grid gap-3 md:grid-cols-2">
            <input
              name="name"
              required
              placeholder={t("productNamePlaceholder")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              name="price"
              required
              type="number"
              min="1"
              step="0.01"
              placeholder={t("pricePlaceholder")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              name="stock"
              type="number"
              min="0"
              defaultValue={999}
              placeholder={t("stockPlaceholder")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              name="commissionPercent"
              type="number"
              min="1"
              max="90"
              defaultValue={30}
              placeholder={t("commissionPctPlaceholder")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              name="image"
              placeholder={t("imagePlaceholder")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm md:col-span-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <textarea
              name="description"
              placeholder={t("descriptionPlaceholder")}
              className="md:col-span-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              disabled={saving}
              className="md:col-span-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {saving ? t("saving") : t("addProduct")}
            </button>
          </form>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold">{t("myProducts")}</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("emptyProducts")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-900">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 100vw, 33vw"
                        unoptimized={p.image.startsWith("http")}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">{t("noImage")}</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-semibold leading-tight">{p.name}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{formatEurCents(p.priceCents)}</p>
                    <p className="text-xs text-zinc-500">
                      {t("stockLabel")}: {p.stock}
                    </p>
                    <p className="text-xs">{p.active ? t("statusActive") : t("statusInactive")}</p>
                    <button
                      type="button"
                      onClick={() => toggleProduct(p.id, p.active)}
                      className="mt-auto rounded-md border border-zinc-300 px-3 py-2 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      {p.active ? t("toggleActive") : t("toggleInactive")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label={t("totalSalesLabel")} value={kpis.ventesTotales.toLocaleString(locale)} />
          <KpiCard label={t("revenueLabel")} value={`${kpis.revenus.toLocaleString(locale)} EUR`} />
          <KpiCard label={t("activeAffiliatesLabel")} value={kpis.affiliesActifs.toLocaleString(locale)} />
          <KpiCard label={t("commissionsOwedLabel")} value={`${kpis.commissionsAPayer.toLocaleString(locale)} EUR`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">{t("salesByProduct")}</h2>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">{t("salesSubtitle")}</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByProduct}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                  <XAxis dataKey="produit" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={65} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [Number(value ?? 0).toLocaleString(locale), t("salesAxis")]} />
                  <Bar dataKey="ventes" fill="#18181b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">{t("quickStats")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">{t("avgBasket")}</span>
                <strong>{panierMoyen}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">{t("estimatedMargin")}</span>
                <strong>{Math.round(kpis.revenus * 0.42).toLocaleString(locale)} EUR</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">{t("activeProducts")}</span>
                <strong>{mine.filter((p) => p.active).length}</strong>
              </li>
            </ul>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-lg font-semibold">{t("topAffiliates")}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-2 pr-4">{t("affiliateCol")}</th>
                    <th className="py-2 pr-4">{t("salesCol")}</th>
                    <th className="py-2">{t("commissionCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topAffiliates.map((row) => (
                    <tr key={row.nom} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-4">{row.nom}</td>
                      <td className="py-2 pr-4">{row.ventes.toLocaleString(locale)}</td>
                      <td className="py-2 font-medium">{row.commission.toLocaleString(locale)} EUR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
