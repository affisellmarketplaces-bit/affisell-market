"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type CatalogProduct = {
  id: string
  name: string
  description: string
  basePriceCents: number
  commissionRate: number
  image: string
  supplier: { email: string }
}

type ListingRow = {
  id: string
  sellingPriceCents: number
  active: boolean
  product: CatalogProduct | null
}

type Props = {
  user: { id: string; email?: string | null }
  boutiqueHref: string | null
  storefrontSlug: string | null
  kpis: { payoutsCents: number; orders: number }
  revenus30j: { day: string; revenus: number }[]
  recentSales: { date: string; produit: string; payout: number }[]
  products: CatalogProduct[]
  listings: ListingRow[]
}

export function AffiliateLiveDashboard({
  user,
  boutiqueHref,
  storefrontSlug,
  kpis,
  revenus30j,
  recentSales,
  products,
  listings,
}: Props) {
  const router = useRouter()
  const t = useTranslations("affiliate")
  const [toast, setToast] = useState<string | null>(null)
  const [addForId, setAddForId] = useState<string | null>(null)
  const [sellEur, setSellEur] = useState<string>("")
  const [localListings, setLocalListings] = useState(listings)

  useEffect(() => setLocalListings(listings), [listings])

  function fmtEurCents(c: number) {
    return (c / 100).toLocaleString("en-US", { style: "currency", currency: "EUR" })
  }

  async function submitAdd(productId: string, basePriceCents: number) {
    const euros = Number(sellEur.replace(",", "."))
    if (!Number.isFinite(euros) || euros * 100 < basePriceCents) {
      setToast(t("addFailedToast"))
      setTimeout(() => setToast(null), 2400)
      return
    }
    const sellingPriceCents = Math.round(euros * 100)
    const res = await fetch("/api/affiliate/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, sellingPriceCents }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setToast(data.error || t("addFailedToast"))
      setTimeout(() => setToast(null), 2200)
      return
    }
    setToast(t("addedToast"))
    setTimeout(() => setToast(null), 1800)
    setAddForId(null)
    setSellEur("")
    router.refresh()
  }

  async function patchListing(listingId: string, body: Record<string, boolean | number>) {
    const res = await fetch(`/api/affiliate/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setToast(data.error || t("addFailedToast"))
      setTimeout(() => setToast(null), 2400)
      return
    }
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white p-6 text-zinc-900 md:p-10 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("dashboardTagline")}</p>
            <h1 className="text-3xl font-semibold">
              {t("hello")} {user.email ?? t("guestName")}
            </h1>
            {boutiqueHref && storefrontSlug ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                <span>{t("publicStoreLead")} </span>
                <a href={boutiqueHref} className="font-medium underline" target="_blank" rel="noreferrer">
                  {boutiqueHref.replace(/^https?:\/\//, "")}
                </a>
              </p>
            ) : null}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard label={t("sales") + " · " + t("kPayoutMonth")} value={fmtEurCents(kpis.payoutsCents)} />
          <KpiCard label={t("kOrders")} value={kpis.orders.toLocaleString("en-US")} />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">{t("supplierCatalog")}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="relative aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-900">
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
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {p.description || t("catalogNoDescription")}
                  </p>
                  <p className="text-sm">
                    {fmtEurCents(p.basePriceCents)} · {t("marginNote", { rate: p.commissionRate })}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t("supplierPrefix")}: {p.supplier.email}
                  </p>
                  {addForId === p.id ? (
                    <div className="mt-2 space-y-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
                      <label className="block text-xs text-zinc-500">
                        {t("sellingPriceLabel")}
                        <input
                          type="number"
                          min={(p.basePriceCents / 100).toFixed(2)}
                          step="0.01"
                          value={sellEur}
                          onChange={(e) => setSellEur(e.target.value)}
                          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => submitAdd(p.id, p.basePriceCents)}
                          className="flex-1 rounded-md bg-black px-2 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          {t("addToStore")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddForId(null)}
                          className="rounded-md border px-2 py-1.5 text-xs dark:border-zinc-600"
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddForId(p.id)
                        setSellEur((p.basePriceCents / 100).toFixed(2))
                      }}
                      className="mt-auto rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      {t("addToStore")}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold">{t("mySelection")}</h2>
          {localListings.filter((row) => row.product).length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("selectionHint")}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {localListings
                .filter((row): row is ListingRow & { product: CatalogProduct } =>
                  Boolean(row.product)
                )
                .map((row) => (
                  <article key={row.id} className="flex gap-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="relative h-28 w-28 shrink-0 bg-zinc-100 dark:bg-zinc-900">
                      {row.product!.image ? (
                        <Image
                          src={row.product!.image}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized={row.product!.image.startsWith("http")}
                          sizes="112px"
                        />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pr-3 text-sm">
                      <p className="truncate font-semibold">{row.product!.name}</p>
                      <p className="text-zinc-600 dark:text-zinc-400">{fmtEurCents(row.sellingPriceCents)}</p>
                      <label className="mt-2 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.active}
                          onChange={(e) => {
                            const next = e.target.checked
                            setLocalListings((prev) =>
                              prev.map((l) => (l.id === row.id ? { ...l, active: next } : l))
                            )
                            void patchListing(row.id, { active: next })
                          }}
                        />
                        <span>{row.active ? t("toggleListing") : t("hideListing")}</span>
                      </label>
                      <p className="text-[11px] text-zinc-400">{t("listingActiveHelp")}</p>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">{t("revenue30")}</h2>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">{t("revenueSubtitle")}</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenus30j}>
                <defs>
                  <linearGradient id="affRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [Number(value ?? 0).toLocaleString("en-US"), t("revenueLabel")]} />
                <Area type="monotone" dataKey="revenus" stroke="#18181b" fill="url(#affRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {toast ? (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-md bg-black px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">{t("recentSales")}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-2 pr-4">{t("dateCol")}</th>
                  <th className="py-2 pr-4">{t("productCol")}</th>
                  <th className="py-2">{t("payoutCol")}</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((row, i) => (
                  <tr key={`${row.date}-${row.produit}-${i}`} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-4">{row.date}</td>
                    <td className="py-2 pr-4">{row.produit}</td>
                    <td className="py-2 font-medium">
                      {(row.payout / 100).toLocaleString("en-US", { style: "currency", currency: "EUR" })}
                    </td>
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
