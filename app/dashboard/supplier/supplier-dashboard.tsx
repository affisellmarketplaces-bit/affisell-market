"use client"

import Image from "next/image"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { SupplierProductForm, type SupplierProductRecord } from "@/components/supplier-product-form"
import { primaryProductImage } from "@/lib/product-images"

export type SupplierDashboardStats = {
  activeProducts: number
  draftProducts: number
  affiliateCount: number
  affiliatesThisWeek: number
  monthRevenueCents: number
  monthOrderCount: number
  orderMonthDeltaPct: number | null
  storefrontClicks: number
}

type SupplierDashboardProps = {
  storeSlug: string | null
  stats: SupplierDashboardStats
}

export function SupplierDashboard({ storeSlug, stats }: SupplierDashboardProps) {
  const router = useRouter()
  const [products, setProducts] = useState<SupplierProductRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<SupplierProductRecord | null>(null)

  async function load() {
    const res = await fetch("/api/supplier/products", {
      cache: "no-store",
      credentials: "include",
    })
    if (!res.ok) return
    const data = (await res.json()) as SupplierProductRecord[]
    if (Array.isArray(data)) {
      setProducts(
        data.map((p) => ({
          ...p,
          images: Array.isArray(p.images) ? p.images : [],
          categories: Array.isArray(p.categories) ? p.categories : [],
          colors: Array.isArray(p.colors) ? p.colors : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
          stock: typeof p.stock === "number" ? p.stock : 0,
        }))
      )
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch("/api/supplier/products", {
          cache: "no-store",
          credentials: "include",
          signal: ac.signal,
        })
        if (!res.ok || ac.signal.aborted) return
        const data = (await res.json()) as SupplierProductRecord[]
        if (ac.signal.aborted || !Array.isArray(data)) return
        setProducts(
          data.map((p) => ({
            ...p,
            images: Array.isArray(p.images) ? p.images : [],
            categories: Array.isArray(p.categories) ? p.categories : [],
            colors: Array.isArray(p.colors) ? p.colors : [],
            tags: Array.isArray(p.tags) ? p.tags : [],
            stock: typeof p.stock === "number" ? p.stock : 0,
          }))
        )
      } catch {
        /* aborted */
      }
    })()
    return () => ac.abort()
  }, [])

  const openEdit = (p: SupplierProductRecord) => {
    setEditing(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? "Delete failed")
      }
      if (editing?.id === id) setEditing(null)
      await load()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed")
      await load()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function fmtEUR(cents: number) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "EUR" })
  }

  const storePreviewHref = storeSlug
    ? `/store/supplier/${encodeURIComponent(storeSlug)}`
    : "/dashboard/supplier/storefront"

  async function handleFormSuccess() {
    await load()
    router.refresh()
    setEditing(null)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Supplier · My products</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <Link href="/supplier/dashboard" className="text-blue-600 hover:underline dark:text-blue-400">
              Open full-screen product wizard →
            </Link>
            <Link href="/seller/photo-studio" className="text-purple-600 hover:underline dark:text-purple-400">
              Enhance Photos in Affisell Studio →
            </Link>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <Link
            href={storePreviewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-white transition hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            View my store
          </Link>
          <Link
            href="/dashboard/supplier/import"
            className="ml-2 flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 font-medium text-white shadow-lg hover:from-purple-700 hover:to-pink-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
              />
            </svg>
            Import Products
            <span className="rounded bg-white/20 px-2 py-0.5 text-xs">AI</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-1 text-sm text-zinc-500">Active products</p>
          <p className="text-3xl font-semibold">{stats.activeProducts}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {stats.draftProducts} {stats.draftProducts === 1 ? "draft" : "drafts"}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-1 text-sm text-zinc-500">Active affiliates</p>
          <p className="text-3xl font-semibold">{stats.affiliateCount}</p>
          <p
            className={
              stats.affiliatesThisWeek > 0 ? "mt-1 text-xs text-green-600" : "mt-1 text-xs text-zinc-400"
            }
          >
            {stats.affiliatesThisWeek > 0
              ? `+${stats.affiliatesThisWeek} this week`
              : "No new affiliates this week"}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-1 text-sm text-zinc-500">Sales this month</p>
          <p className="text-3xl font-semibold">{fmtEUR(stats.monthRevenueCents)}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {stats.monthOrderCount} {stats.monthOrderCount === 1 ? "order" : "orders"}
            {stats.orderMonthDeltaPct !== null ? (
              <span
                className={
                  stats.orderMonthDeltaPct >= 0 ? "text-green-600" : "text-amber-700 dark:text-amber-500"
                }
              >
                {" "}
                · {stats.orderMonthDeltaPct >= 0 ? "+" : ""}
                {stats.orderMonthDeltaPct}% vs last month
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-1 text-sm text-zinc-500">Store views</p>
          <p className="text-3xl font-semibold">
            {stats.storefrontClicks.toLocaleString("en-US")}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Total clicks on affiliate listings</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        <Link href="/dashboard/supplier/storefront" className="text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white">
          Store profile →
        </Link>
        <Link href="/dashboard/settings/social" className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
          Social &amp; community hub →
        </Link>
        <Link
          href="/dashboard/settings/account"
          className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
        >
          Account &amp; connected logins →
        </Link>
      </div>

      <SupplierProductForm
        resetKey={editing?.id ?? "new"}
        initial={editing}
        onSuccess={handleFormSuccess}
      />

      {error ? <p className="my-4 text-sm text-red-600">{error}</p> : null}

      <section className="mt-10">
        <h2 className="text-lg font-medium">Your catalog</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.length === 0 ? (
            <p className="col-span-full text-zinc-500">No products yet.</p>
          ) : (
            products.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-gray-50 dark:bg-zinc-800">
                  <Image
                    src={primaryProductImage(p.images) || "/placeholder.png"}
                    alt={p.name}
                    fill
                    className="object-contain p-2"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    unoptimized={primaryProductImage(p.images).startsWith("http")}
                  />
                </div>
                <div className="p-4">
                  <p className="font-semibold">{p.name}</p>
                  {(p.categories?.length ?? 0) > 0 ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
                      {(p.categories ?? []).slice(0, 3).join(" · ")}
                    </p>
                  ) : null}
                  {p.images.length > 1 ? (
                    <p className="mt-0.5 text-xs text-zinc-500">{p.images.length} images</p>
                  ) : null}
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{fmtEUR(p.basePriceCents)}</p>
                  <p className="mt-1 text-xs text-zinc-500">Commission on margin: {p.commissionRate}%</p>
                  <p className="mt-1 text-xs text-zinc-500">Stock: {p.stock}</p>
                  <p className="mt-2 text-xs">{p.active ? "Active" : "Inactive"}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleActive(p.id, Boolean(p.active))}
                    className="mt-3 text-xs underline"
                  >
                    Toggle active
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
