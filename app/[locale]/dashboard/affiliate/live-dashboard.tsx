"use client"

import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
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

type MarketProduct = {
  id: string
  name: string
  description: string | null
  priceCents: number
  image: string | null
  commissionPercent: number
  supplier: { name: string | null; email: string }
}

type Props = {
  user: { id: string; name?: string | null; email?: string | null }
  boutiquePublicLabel: string | null
  boutiqueHref: string | null
  kpis: {
    commissionsMois: number
    clics: number
    conversions: number
    taux: number
  }
  revenus30j: { day: string; revenus: number }[]
  ventesRecentes: { date: string; produit: string; commission: number }[]
  products: MarketProduct[]
  selection: MarketProduct[]
}

function formatEur(value: number, locale: string) {
  return (value / 100).toLocaleString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: "EUR",
  })
}

export function AffiliateLiveDashboard({
  user,
  boutiquePublicLabel,
  boutiqueHref,
  kpis,
  revenus30j,
  ventesRecentes,
  products,
  selection,
}: Props) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("affiliate")
  const [toast, setToast] = useState<string | null>(null)

  async function addToMyStore(productId: string) {
    const res = await fetch("/api/affiliate/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setToast(data.error || t("addFailedToast"))
      setTimeout(() => setToast(null), 2200)
      return
    }
    setToast(t("addedToast"))
    setTimeout(() => setToast(null), 1800)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white p-6 text-zinc-900 md:p-10 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("dashboardTagline")}</p>
            <h1 className="text-3xl font-semibold">
              {t("hello")}{" "}
              {user.name ?? user.email ?? t("guestName")}
            </h1>
            {boutiquePublicLabel && boutiqueHref ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                <span>{t("publicStoreLead")} </span>
                <a href={boutiqueHref} className="font-medium underline" target="_blank" rel="noreferrer">
                  {boutiquePublicLabel}
                </a>
              </p>
            ) : null}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("kCommission")}
            value={`${kpis.commissionsMois.toLocaleString(locale)} ${locale === "en" ? "EUR" : "€"}`}
          />
          <KpiCard label={t("kClicks")} value={kpis.clics.toLocaleString(locale)} />
          <KpiCard label={t("kConv")} value={kpis.conversions.toLocaleString(locale)} />
          <KpiCard label={t("kRate")} value={`${kpis.taux.toFixed(2)}%`} />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">{t("marketplaceCatalog")}</h2>
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
                    {formatEur(p.priceCents, locale)} · {p.commissionPercent}%
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t("supplierPrefix")}: {p.supplier.name || p.supplier.email}
                  </p>
                  <button
                    type="button"
                    onClick={() => addToMyStore(p.id)}
                    className="mt-auto rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    {t("addToStore")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold">{t("mySelection")}</h2>
          {selection.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("selectionHint")}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selection.map((p) => (
                <article key={p.id} className="flex overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="relative h-28 w-28 shrink-0 bg-zinc-100 dark:bg-zinc-900">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized={p.image.startsWith("http")}
                        sizes="112px"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col justify-center p-3 text-sm">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">{formatEur(p.priceCents, locale)}</p>
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
                  <linearGradient id="affRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString(locale)} EUR`, t("revenueLabel")]}
                />
                <Area type="monotone" dataKey="revenus" stroke="#18181b" fill="url(#affRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {toast ? (
          <div className="fixed bottom-6 right-6 z-50 rounded-md bg-black px-4 py-2 text-sm text-white shadow-lg">
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
                  <th className="py-2">{t("commissionCol")}</th>
                </tr>
              </thead>
              <tbody>
                {ventesRecentes.map((row) => (
                  <tr key={`${row.date}-${row.produit}`} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-4">{row.date}</td>
                    <td className="py-2 pr-4">{row.produit}</td>
                    <td className="py-2 font-medium">{row.commission.toLocaleString(locale)} EUR</td>
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
