"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"

import { AffiliateCommissionCard } from "@/components/affiliate-commission-card"
import { VerifiedBadge } from "@/components/suppliers/verified-badge"
import { formatStoreCurrency } from "@/lib/market-config"
import { variantsFromDb, type ProductVariantLine } from "@/lib/product-variants"

type AffiliateProductPayload = {
  listing: {
    id: string
    sellingPriceCents: number
    isListed: boolean
    customTitle: string | null
    customSlug: string | null
  }
  product: {
    id: string
    name: string
    basePriceCents: number
    variants: unknown
    commissionRate: number
    listingKind: string
    active: boolean
    supplier: {
      isVerifiedSupplier: boolean
    }
  }
}

type SupplierProductPayload = {
  id: string
  name: string
  basePriceCents: number
  variants: unknown
  commissionRate: number
  stock: number
  active: boolean
}

function commissionVariantLines(product: {
  basePriceCents: number
  commissionRate: number
  variants: unknown
}): ProductVariantLine[] {
  const parsed = variantsFromDb(product.variants)
  const rows = parsed?.variantRows
  if (rows && rows.length > 0) return rows
  const pct = Number(product.commissionRate)
  const commission = Number.isFinite(pct) ? Math.min(50, Math.max(1, Math.round(pct))) : 20
  return [
    {
      id: "default",
      name: "Default option",
      sku: "DEFAULT",
      priceCents: 0,
      stock: 0,
      commission,
      sales: 0,
    },
  ]
}

export default function DashboardProductDetailPage() {
  const params = useParams<{ id: string }>()
  const { data: session, status } = useSession()
  const listingId = params?.id ?? ""

  const rawRole = String(session?.user?.role ?? "").toUpperCase()
  const isBuyer = rawRole === "CUSTOMER" || rawRole === ""

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"affiliate" | "supplier" | null>(null)
  const [affiliateData, setAffiliateData] = useState<AffiliateProductPayload | null>(null)
  const [supplierData, setSupplierData] = useState<SupplierProductPayload | null>(null)

  const load = useCallback(async () => {
    if (!listingId) {
      setLoading(false)
      setError("Missing product or listing id.")
      return
    }
    if (status !== "authenticated") return
    setLoading(true)
    setError(null)
    setMode(null)
    setAffiliateData(null)
    setSupplierData(null)

    if (rawRole === "AFFILIATE" || rawRole === "ADMIN") {
      const res = await fetch(`/api/affiliate/products/${encodeURIComponent(listingId)}`, {
        credentials: "include",
      })
      if (res.ok) {
        const data = (await res.json()) as AffiliateProductPayload
        setAffiliateData(data)
        setMode("affiliate")
        setLoading(false)
        return
      }
      if (res.status !== 404) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? "Could not load listing.")
        setLoading(false)
        return
      }
      if (rawRole === "AFFILIATE") {
        setError("Listing not found or you do not have access.")
        setLoading(false)
        return
      }
    }

    if (rawRole === "SUPPLIER" || rawRole === "ADMIN") {
      const res = await fetch(`/api/supplier/products/${encodeURIComponent(listingId)}`, {
        credentials: "include",
      })
      if (res.ok) {
        const data = (await res.json()) as SupplierProductPayload
        setSupplierData(data)
        setMode("supplier")
        setLoading(false)
        return
      }
      if (res.status !== 404) {
        const j2 = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j2.error ?? "Could not load product.")
        setLoading(false)
        return
      }
    }

    setError("Listing or product not found, or you do not have access.")
    setLoading(false)
  }, [listingId, rawRole, status])

  useEffect(() => {
    void load()
  }, [load])

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm text-zinc-500 dark:text-zinc-300">Loading…</p>
      </main>
    )
  }

  if (status === "unauthenticated") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Product</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          <Link href={`/login?callbackUrl=/dashboard/products/${encodeURIComponent(listingId)}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400">
            Sign in
          </Link>{" "}
          to open seller tools.
        </p>
      </main>
    )
  }

  if (isBuyer) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Dashboard Product</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Seller tools are only available for seller or admin accounts.
        </p>
      </main>
    )
  }

  if (error || !mode) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Product</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error ?? "Not found."}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-violet-700 hover:underline dark:text-violet-400">
          Back to dashboard
        </Link>
      </main>
    )
  }

  if (mode === "affiliate" && affiliateData) {
    const { listing, product } = affiliateData
    const basePriceEur = product.basePriceCents / 100
    const lines = commissionVariantLines(product)
    const displayTitle = listing.customTitle?.trim() || product.name

    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
          Affiliate listing
        </p>
        {product.supplier.isVerifiedSupplier ? <VerifiedBadge className="mt-2" /> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{displayTitle}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Listing ID <span className="font-mono text-xs">{listing.id}</span>
          {listing.isListed ? (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              Listed
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              Hidden
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">
          Your selling price:{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {formatStoreCurrency(listing.sellingPriceCents / 100)}
          </span>{" "}
          · Supplier base {formatStoreCurrency(basePriceEur)}
        </p>

        <section className="affiliate-section mt-8 space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
            Affiliate earnings by option
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {lines.map((variant) => (
              <AffiliateCommissionCard key={variant.id} variant={variant} basePriceEur={basePriceEur} />
            ))}
          </div>
        </section>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href={`/marketplace/${listing.id}`}
            className="block rounded-xl border border-zinc-300 py-3 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            View on marketplace
          </Link>
          <Link
            href="/dashboard/affiliate"
            className="block rounded-xl bg-zinc-900 py-3 text-center text-sm font-medium text-white hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Affiliate hub
          </Link>
        </div>
      </main>
    )
  }

  if (mode === "supplier" && supplierData) {
    const p = supplierData
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Catalog product</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{p.name}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Product ID <span className="font-mono text-xs">{p.id}</span>
        </p>
        <ul className="mt-4 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
          <li>Base price: {formatStoreCurrency(p.basePriceCents / 100)}</li>
          <li>Stock: {p.stock}</li>
          <li>Affiliate commission (margin share): {p.commissionRate}%</li>
          <li>Status: {p.active ? "Active" : "Inactive"}</li>
        </ul>

        <div className="mt-8">
          <Link
            href={`/dashboard/supplier/products/new?edit=${encodeURIComponent(p.id)}`}
            className="inline-flex rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Edit in supplier editor
          </Link>
        </div>
      </main>
    )
  }

  return null
}
