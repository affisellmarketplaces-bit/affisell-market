"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useEffect, useState } from "react"

export type SupplierProductRow = {
  id: string
  name: string
  description: string
  basePriceCents: number
  commissionRate: number
  image: string
  active: boolean
}

type Props = {
  user: { id: string; email?: string | null }
  products: SupplierProductRow[]
}

export function SupplierLiveDashboard({ user, products }: Props) {
  const router = useRouter()
  const t = useTranslations("supplier")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState(products)

  useEffect(() => setMine(products), [products])

  async function refreshMyProductsFromApi() {
    const resList = await fetch("/api/products", { cache: "no-store" })
    if (!resList.ok) return
    const data = (await resList.json()) as SupplierProductRow[]
    if (Array.isArray(data)) setMine(data)
  }

  async function onCreateProduct(formData: FormData) {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: String(formData.get("name") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        basePrice: Number(formData.get("basePrice") || 0),
        commissionRate: Number(formData.get("commissionRate") || 20),
        image: String(formData.get("image") || "").trim(),
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
    return (value / 100).toLocaleString("en-US", {
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
            {t("hello")} {user.email ?? t("guestName")}
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
              name="basePrice"
              required
              type="number"
              min="1"
              step="0.01"
              placeholder={t("basePricePlaceholder")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              name="commissionRate"
              type="number"
              min="1"
              max="99"
              defaultValue={20}
              placeholder={t("commissionRatePlaceholder")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              name="image"
              placeholder={t("imagePlaceholder")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
          <p className="mt-2 text-xs text-zinc-500">{t("newProductHint")}</p>
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
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{formatEurCents(p.basePriceCents)}</p>
                    <p className="text-xs text-zinc-500">
                      {t("commissionLabel")}: {p.commissionRate}%
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
      </section>
    </main>
  )
}
