"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  COLORS,
  VARIANT_GROUP_LABELS,
  isMulticolorSwatch,
  type VariantGroupKey,
} from "@/lib/product-catalog-constants"
import type { ProductVariantsJson } from "@/lib/product-variants"

type Props = {
  listingId: string
  name: string
  description: string
  sellerLabel: string
  priceDisplay: string
  gallery: string[]
  categories: string[]
  colorNames: string[]
  tags: string[]
  variants: ProductVariantsJson | null
}

const VARIANT_KEYS: VariantGroupKey[] = ["size", "storage", "ram", "material"]

export function MarketplaceListingDetail({
  listingId,
  name,
  description,
  sellerLabel,
  priceDisplay,
  gallery,
  categories,
  colorNames,
  tags,
  variants,
}: Props) {
  const router = useRouter()
  const urls = gallery
  const safeUrls = urls.length > 0 ? urls : ["/placeholder.png"]
  const v = variants ?? {}

  const [selectedImage, setSelectedImage] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [cartBusy, setCartBusy] = useState(false)
  const [buyBusy, setBuyBusy] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string | null>(colorNames[0] ?? null)
  const [variantPick, setVariantPick] = useState<Partial<Record<VariantGroupKey, string>>>({})

  const idxMax = safeUrls.length - 1

  useEffect(() => {
    setSelectedImage((i) => Math.min(i, idxMax))
  }, [idxMax])

  const heroFromColor = selectedColor ? v.imageByColor?.[selectedColor] : undefined
  const carouselSrc = safeUrls[selectedImage] ?? "/placeholder.png"
  const heroSrc = heroFromColor?.trim() || carouselSrc

  const goPrev = useCallback(() => {
    setSelectedImage((i) => (i <= 0 ? idxMax : i - 1))
  }, [idxMax])

  const goNext = useCallback(() => {
    setSelectedImage((i) => (i >= idxMax ? 0 : i + 1))
  }, [idxMax])

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.defaultPrevented) return
      const t = ev.target as HTMLElement
      if (t.closest("input, textarea, select, [contenteditable]")) return
      if (ev.key === "ArrowLeft") {
        ev.preventDefault()
        goPrev()
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault()
        goNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goPrev, goNext])

  async function addToCart(productId: string) {
    setCartBusy(true)
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
        credentials: "include",
      })
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/marketplace/${productId}`)}`)
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setToast(data.error ?? "Could not add to cart")
        setTimeout(() => setToast(null), 3000)
        return
      }
      setToast("Added to cart")
      setTimeout(() => router.push("/cart"), 900)
    } finally {
      setCartBusy(false)
    }
  }

  async function buyNow(productId: string) {
    setBuyBusy(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, qty: 1 }),
        credentials: "include",
      })
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/marketplace/${productId}`)}`)
        return
      }
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else {
        setToast(data.error ?? "Checkout unavailable")
        setTimeout(() => setToast(null), 3000)
      }
    } finally {
      setBuyBusy(false)
    }
  }

  const colorMeta = useMemo(() => {
    const map = new Map(COLORS.map((c) => [c.name, c]))
    return colorNames.map((n) => ({ name: n, meta: map.get(n) }))
  }, [colorNames])

  const thumbCount = urls.length > 1 ? urls.length : 0
  const showArrowsMain = idxMax >= 1

  return (
    <>
      <Link href="/marketplace" className="text-sm text-zinc-500 underline dark:text-zinc-400">
        ← Marketplace
      </Link>

      {categories.length > 0 ? (
        <nav className="mt-4 flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/marketplace" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            Store
          </Link>
          {categories.map((c) => (
            <span key={c} className="flex items-center gap-1">
              <span className="text-zinc-400">/</span>
              <span className="text-zinc-700 dark:text-zinc-300">{c}</span>
            </span>
          ))}
        </nav>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:gap-10 lg:items-start">
        {/* Gallery */}
        <div className="w-full lg:w-[60%] lg:max-w-none">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-zinc-800">
            <Image
              src={heroSrc}
              alt={name}
              fill
              className="object-contain p-2"
              sizes="(max-width: 1024px) 100vw, 58vw"
              priority
              unoptimized={heroSrc.startsWith("http") || heroSrc.startsWith("blob:")}
            />
            {showArrowsMain ? (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg shadow-md ring-1 ring-zinc-200 hover:bg-white dark:bg-zinc-900/90 dark:ring-zinc-600"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={goNext}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg shadow-md ring-1 ring-zinc-200 hover:bg-white dark:bg-zinc-900/90 dark:ring-zinc-600"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
          {thumbCount > 0 ? (
            <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
              {urls.slice(0, 10).map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setSelectedImage(i)}
                  className={`relative aspect-square overflow-hidden rounded-lg bg-gray-50 ring-offset-2 dark:bg-zinc-800 ${
                    selectedImage === i ? "ring-2 ring-blue-500" : "ring-0 hover:opacity-90"
                  }`}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    className="object-contain p-1"
                    sizes="72px"
                    unoptimized={url.startsWith("http")}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Info + actions */}
        <div className="w-full lg:w-[40%]">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{name}</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>

          {colorNames.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Color</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {colorMeta.map(({ name: cn, meta }) => {
                  const sel = selectedColor === cn
                  const mc = meta ? isMulticolorSwatch(meta) : false
                  const isLight =
                    meta &&
                    !mc &&
                    (meta.hex === "#FFFFFF" || meta.hex === "#F5E6D3" || meta.hex === "#FFD700")
                  return (
                    <button
                      key={cn}
                      type="button"
                      title={cn}
                      onClick={() => setSelectedColor(cn)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-1.5 text-[10px] ${
                        sel ? "border-blue-500 ring-2 ring-blue-400" : "border-zinc-200 dark:border-zinc-600"
                      }`}
                    >
                      <span
                        className={`h-9 w-9 rounded-full shadow-inner ring-1 ring-black/15 ${
                          mc
                            ? "bg-[conic-gradient(at_50%_50%,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]"
                            : ""
                        }`}
                        style={mc || !meta ? undefined : { backgroundColor: meta.hex }}
                      />
                      <span
                        className={
                          isLight ? "max-w-[3.75rem] text-zinc-800 dark:text-zinc-200" : "max-w-[3.75rem]"
                        }
                      >
                        {cn}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {VARIANT_KEYS.map((key) => {
            const opts = v[key]
            if (!opts || opts.length === 0) return null
            return (
              <div key={key} className="mt-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {VARIANT_GROUP_LABELS[key]}
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  value={variantPick[key] ?? ""}
                  onChange={(e) =>
                    setVariantPick((prev) => ({ ...prev, [key]: e.target.value || undefined }))
                  }
                >
                  <option value="">Choose...</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}

          {v.model ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">Model: </span>
              {v.model}
            </p>
          ) : null}

          <div className="mt-4 text-3xl font-bold text-green-600">{priceDisplay}</div>
          <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">Free shipping • 30-day returns</p>

          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            by <span className="font-medium text-zinc-700 dark:text-zinc-300">{sellerLabel}</span>
          </p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={cartBusy}
              onClick={() => void addToCart(listingId)}
              className="w-full rounded-xl bg-black py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {cartBusy ? "Adding…" : "Add to Cart"}
            </button>
            <button
              type="button"
              disabled={buyBusy}
              onClick={() => void buyNow(listingId)}
              className="w-full rounded-xl bg-green-600 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {buyBusy ? "Redirecting…" : `Buy Now - ${priceDisplay}`}
            </button>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-8 right-8 z-50 max-w-xs rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900">
          {toast}
        </div>
      ) : null}
    </>
  )
}
