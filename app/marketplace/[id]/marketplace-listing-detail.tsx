"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

type Props = {
  listingId: string
  name: string
  description: string
  sellerLabel: string
  priceDisplay: string
  gallery: string[]
}

export function MarketplaceListingDetail({
  listingId,
  name,
  description,
  sellerLabel,
  priceDisplay,
  gallery,
}: Props) {
  const router = useRouter()
  const urls = gallery
  const safeUrls = urls.length > 0 ? urls : ["/placeholder.png"]
  const [selectedImage, setSelectedImage] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [cartBusy, setCartBusy] = useState(false)
  const [buyBusy, setBuyBusy] = useState(false)

  const idxMax = safeUrls.length - 1

  useEffect(() => {
    setSelectedImage((i) => Math.min(i, idxMax))
  }, [idxMax])

  const goPrev = useCallback(() => {
    setSelectedImage((i) => (i <= 0 ? idxMax : i - 1))
  }, [idxMax])

  const goNext = useCallback(() => {
    setSelectedImage((i) => (i >= idxMax ? 0 : i + 1))
  }, [idxMax])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement
      if (t.closest("input, textarea, select, [contenteditable]")) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
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

  const currentSrc = safeUrls[selectedImage] ?? "/placeholder.png"
  const thumbCount = urls.length > 1 ? urls.length : 0

  return (
    <>
      <Link href="/marketplace" className="text-sm text-zinc-500 underline dark:text-zinc-400">
        ← Marketplace
      </Link>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:gap-10 lg:items-start">
        {/* Gallery */}
        <div className="w-full lg:w-[60%] lg:max-w-none">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-zinc-800">
            <Image
              src={currentSrc}
              alt={name}
              fill
              className="object-contain p-2"
              sizes="(max-width: 1024px) 100vw, 58vw"
              priority
              unoptimized={currentSrc.startsWith("http") || currentSrc.startsWith("blob:")}
            />
            {safeUrls.length > 1 ? (
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
