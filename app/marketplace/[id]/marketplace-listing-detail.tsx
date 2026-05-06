"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Sparkles, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type MouseEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  COLORS,
  VARIANT_GROUP_LABELS,
  isMulticolorSwatch,
  type VariantGroupKey,
} from "@/lib/product-catalog-constants"
import { addGuestCartItem } from "@/lib/guest-cart"
import type { ProductColorImageRow } from "@/lib/product-color-images"
import type { ProductVariantsJson } from "@/lib/product-variants"

type StorefrontInfo = {
  name: string
  slug: string
  logoUrl: string | null
  showTrustedSoldBy: boolean
}

export type ListingShippingBlock = {
  deliveryMin: number
  deliveryMax: number
  processingTime: number
  warehouseType: string | null
  warehouseCity: string | null
  shippingCountryLabel: string
  freeShippingThresholdEUR: number | null
}

type RelatedCard = {
  id: string
  href: string
  title: string
  image: string
  priceEur: number
}

type Props = {
  listingId: string
  productId: string
  name: string
  description: string
  sellerLabel: string
  storefront: StorefrontInfo | null
  priceDisplay: string
  gallery: string[]
  categories: string[]
  colorNames: string[]
  tags: string[]
  variants: ProductVariantsJson | null
  colorImages: ProductColorImageRow[]
  shipping: ListingShippingBlock
  listingPriceCents: number
  stock: number
  retailPriceEur?: number
  has3D?: boolean
  arModel?: string | null
  oftenBoughtTogether?: RelatedCard[]
  alsoViewed?: RelatedCard[]
  reviewSummary: {
    count: number
    average: number
    sentiment: string
  }
  ratingBreakdown: Record<number, number>
  reviews: Array<{
    id: string
    rating: number
    author: string
    country: string | null
    date: string
    text: string
    images: string[]
    variant: string | null
    helpful_count: number
    verified: boolean
  }>
}

const VARIANT_KEYS: VariantGroupKey[] = ["size", "storage", "ram", "material"]

function fmtEur(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

export function MarketplaceListingDetail({
  listingId,
  productId,
  name,
  description,
  sellerLabel,
  priceDisplay,
  gallery,
  categories,
  colorNames,
  variants,
  colorImages,
  shipping,
  listingPriceCents,
  stock,
  retailPriceEur,
  has3D = false,
  arModel,
  oftenBoughtTogether = [],
  alsoViewed = [],
  reviewSummary,
  ratingBreakdown,
  reviews,
}: Props) {
  const router = useRouter()
  const images = gallery.length > 0 ? gallery : ["/placeholder.png"]
  const v = variants ?? {}
  const sizeOptions = v.size ?? []

  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedColor, setSelectedColor] = useState<string | null>(colorNames[0] ?? null)
  const [selectedSize, setSelectedSize] = useState<string | null>(sizeOptions[0] ?? null)
  const [cartBusy, setCartBusy] = useState(false)
  const [buyBusy, setBuyBusy] = useState(false)
  const [showAr, setShowAr] = useState(false)
  const [liveViewers, setLiveViewers] = useState(12)
  const [showPurchaseToast, setShowPurchaseToast] = useState(false)
  const [purchaseToastText, setPurchaseToastText] = useState("Sarah from Lyon just bought this 2 min ago")
  const [sizeTip, setSizeTip] = useState<string | null>(null)
  const [showStylist, setShowStylist] = useState(false)
  const [styleIdeas, setStyleIdeas] = useState<string[]>([])
  const [stylistLoading, setStylistLoading] = useState(false)
  const [alertSaved, setAlertSaved] = useState(false)
  const [bundleChecked, setBundleChecked] = useState<Record<string, boolean>>({})

  const colorMeta = useMemo(() => {
    const map = new Map(COLORS.map((c) => [c.name, c]))
    return colorNames.map((n) => ({ name: n, meta: map.get(n) }))
  }, [colorNames])

  const colorRowImage =
    selectedColor != null ? colorImages.find((c) => c.color === selectedColor)?.image?.trim() : ""
  const hero = colorRowImage || images[selectedImage] || "/placeholder.png"
  const listingPriceEur = listingPriceCents / 100
  const hasRetailCompare = typeof retailPriceEur === "number" && retailPriceEur > listingPriceEur
  const discountPct = hasRetailCompare
    ? Math.round(((retailPriceEur - listingPriceEur) / retailPriceEur) * 100)
    : 0
  const bundleCandidates = oftenBoughtTogether.slice(0, 2)
  const bundleSelected = bundleCandidates.filter((p) => bundleChecked[p.id])
  const bundleSubtotal = bundleSelected.reduce((sum, p) => sum + p.priceEur, listingPriceEur)
  const bundleTotal = bundleSelected.length > 0 ? bundleSubtotal * 0.85 : bundleSubtotal
  const bundleSaved = bundleSelected.length > 0 ? bundleSubtotal - bundleTotal : 0

  useEffect(() => {
    const id = setInterval(() => {
      setLiveViewers(Math.floor(Math.random() * 16) + 5)
    }, 6000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setShowPurchaseToast(true)
    const id = setTimeout(() => setShowPurchaseToast(false), 5000)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const people = ["Sarah", "Emma", "Nina", "Lina", "Chloe", "Camille"]
    const cities = ["Lyon", "Marseille", "Toulouse", "Nice", "Lille", "Nantes"]
    const mins = [1, 2, 3, 4, 5, 6]
    const rotate = setInterval(() => {
      const person = people[Math.floor(Math.random() * people.length)]
      const city = cities[Math.floor(Math.random() * cities.length)]
      const min = mins[Math.floor(Math.random() * mins.length)]
      setPurchaseToastText(`${person} from ${city} just bought this ${min} min ago`)
      setShowPurchaseToast(true)
      window.setTimeout(() => setShowPurchaseToast(false), 5000)
    }, 18000)
    return () => clearInterval(rotate)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const prevSize = window.localStorage.getItem("last-size")
    if (prevSize) setSizeTip(`Based on your last purchase, size ${prevSize} fits you 94%`)
    else if (sizeOptions.includes("M")) setSizeTip("Based on your last purchase, size M fits you 94%")
  }, [sizeOptions])

  useEffect(() => {
    if (typeof window === "undefined" || !selectedSize) return
    window.localStorage.setItem("last-size", selectedSize)
  }, [selectedSize])

  async function addToCart(e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    setCartBusy(true)
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: listingId, quantity: 1 }),
        credentials: "include",
      })
      if (res.status === 401) {
        addGuestCartItem({
          productId: listingId,
          qty: 1,
          title: name,
          imageUrl: hero,
          sellerName,
          price: listingPriceEur,
        })
        return
      }
      if (res.ok) router.push("/cart")
    } finally {
      setCartBusy(false)
    }
  }

  async function buyNow() {
    setBuyBusy(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: listingId, qty: 1 }),
        credentials: "include",
      })
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/marketplace/${listingId}`)}`)
        return
      }
      const data = (await res.json()) as { url?: string }
      if (data.url) window.location.href = data.url
    } finally {
      setBuyBusy(false)
    }
  }

  async function openStylist() {
    setShowStylist(true)
    setStylistLoading(true)
    try {
      const res = await fetch("/api/ai/style-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          productName: name,
          selectedColor,
          selectedSize,
        }),
      })
      const data = (await res.json()) as { ideas?: string[] }
      setStyleIdeas(Array.isArray(data.ideas) ? data.ideas.slice(0, 3) : [])
    } finally {
      setStylistLoading(false)
    }
  }

  async function savePriceAlert() {
    const target = Math.max(1, Math.round((listingPriceEur * 0.95) * 100) / 100)
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, targetPrice: target }),
      credentials: "include",
    })
    if (res.ok) setAlertSaved(true)
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="group relative aspect-video overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero}
              alt={name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
            />
            {has3D ? (
              <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">
                360° View
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {images.slice(0, 4).map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setSelectedImage(i)}
                className={`relative aspect-square overflow-hidden rounded-lg border ${
                  selectedImage === i ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          {arModel ? (
            <Button size="lg" variant="outline" className="mt-3" onClick={() => setShowAr(true)}>
              Voir en AR
            </Button>
          ) : null}
        </section>

        <aside className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            {liveViewers} personnes regardent ce produit
          </div>
          <nav className="text-sm text-zinc-500 dark:text-zinc-400">
            Home &gt; {categories[0] || "Fashion"} &gt; {categories[1] || "Blazers"}
          </nav>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{name}</h1>

          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="text-yellow-500">★★★</span>
            <span>{reviewSummary.average.toFixed(1)}</span>
            <span>({reviewSummary.count.toLocaleString("fr-FR")} avis)</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Top rated
            </span>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{priceDisplay}</div>
            {hasRetailCompare ? (
              <span className="mt-1 inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                -{discountPct}% vs retail {fmtEur(retailPriceEur ?? 0)}
              </span>
            ) : null}
          </div>

          {stock <= 5 ? (
            <p className="mt-3 font-medium text-orange-600 dark:text-orange-400">
              Only {Math.max(1, stock)} left in stock - order soon
            </p>
          ) : null}

          {colorMeta.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-semibold">Color</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {colorMeta.map(({ name: cn, meta }) => (
                  <button
                    key={cn}
                    type="button"
                    onClick={() => setSelectedColor(cn)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      selectedColor === cn ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600"
                    }`}
                    style={
                      meta && !isMulticolorSwatch(meta)
                        ? { backgroundColor: meta.hex }
                        : { background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }
                    }
                    title={cn}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {sizeOptions.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-semibold">{VARIANT_GROUP_LABELS.size}</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {sizeOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSize(s)}
                    className={`rounded-lg border px-2 py-2 text-sm ${
                      selectedSize === s
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 dark:border-zinc-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {sizeTip ? (
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              {sizeTip}
            </p>
          ) : null}

          <div className="mt-6 space-y-3">
            <Button size="lg" className="w-full" disabled={cartBusy} onClick={(e) => void addToCart(e)}>
              {cartBusy ? "Adding..." : "Add to Cart"}
            </Button>
            <Button size="lg" variant="outline" className="w-full" disabled={buyBusy} onClick={() => void buyNow()}>
              {buyBusy ? "Redirecting..." : "Buy Now with 1-Click"}
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => void openStylist()}>
              Comment porter ?
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => void savePriceAlert()}>
              {alertSaved ? "Alert saved" : "🔔 Alert me if price drops"}
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>✓ Livraison 48h ✓ Retour 30j ✓ Paiement securise</p>
            <p>Livraison a Aix-en-Provence : Mercredi 8 Mai</p>
          </div>

          <div className="mt-4 rounded-xl border bg-gradient-to-r from-purple-50 to-pink-50 p-3 dark:border-zinc-700 dark:from-purple-950/40 dark:to-pink-950/40">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm">
                Resume IA: Blazer parfait pour bureau et soiree. Coupe moderne. Clients l'adorent pour sa polyvalence.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <p className="text-sm font-semibold">Bundle &amp; Save</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Add matching pants + save 15%</p>
            <div className="mt-3 space-y-2">
              {bundleCandidates.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-2 dark:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={Boolean(bundleChecked[p.id])}
                    onChange={(e) => setBundleChecked((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                  />
                  <span className="line-clamp-1 text-sm">{p.title}</span>
                  <span className="ml-auto text-xs text-zinc-500">{fmtEur(p.priceEur)}</span>
                </label>
              ))}
            </div>
            <motion.p
              key={`${bundleTotal}-${bundleSelected.length}`}
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 text-sm font-medium"
            >
              Bundle total: {fmtEur(bundleTotal)}
              {bundleSelected.length > 0 ? (
                <span className="ml-1 text-green-600">
                  (15% saved - {fmtEur(bundleSaved)})
                </span>
              ) : null}
            </motion.p>
          </div>
        </aside>
      </div>

      <section className="mt-10 space-y-3">
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700" open>
          <summary className="cursor-pointer font-semibold">Description</summary>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{description}</p>
        </details>
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <summary className="cursor-pointer font-semibold">Specs</summary>
          <ul className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Marque: {sellerLabel}</li>
            <li>Couleurs: {colorNames.length || "N/A"}</li>
            <li>Note moyenne: {reviewSummary.average.toFixed(1)} / 5</li>
          </ul>
        </details>
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <summary className="cursor-pointer font-semibold">Livraison</summary>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Livraison {shipping.deliveryMin}-{shipping.deliveryMax} jours ouvrables. Traitement en{" "}
            {shipping.processingTime} jour(s).
          </p>
        </details>
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <summary className="cursor-pointer font-semibold">Avis</summary>
          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="mb-2">
              <Star className="mr-1 inline h-4 w-4 fill-yellow-400 text-yellow-400" />
              {reviewSummary.average.toFixed(1)} ({reviewSummary.count.toLocaleString("fr-FR")} avis)
            </p>
            <p>5★: {ratingBreakdown[5] ?? 0} · 4★: {ratingBreakdown[4] ?? 0} · 3★: {ratingBreakdown[3] ?? 0}</p>
            {reviews.slice(0, 3).map((r) => (
              <p key={r.id} className="mt-2 rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-800">
                "{r.text.slice(0, 140)}"
              </p>
            ))}
          </div>
        </details>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Souvent achetes ensemble</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {oftenBoughtTogether.slice(0, 3).map((p) => (
            <Link key={p.id} href={p.href} className="rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
              <div className="relative aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium">{p.title}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{fmtEur(p.priceEur)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Les clients ont aussi regarde</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {alsoViewed.slice(0, 3).map((p) => (
            <Link key={p.id} href={p.href} className="rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
              <div className="relative aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium">{p.title}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{fmtEur(p.priceEur)}</p>
            </Link>
          ))}
        </div>
      </section>

      {showAr ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">AR Preview</h3>
              <button type="button" onClick={() => setShowAr(false)} className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Close
              </button>
            </div>
            {arModel ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Open the model in a new tab for AR-enabled viewer.
                </p>
                <a
                  href={arModel}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Open AR Model
                </a>
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No AR model available.</p>
            )}
          </div>
        </div>
      ) : null}
      {showStylist ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">AI Stylist</h3>
              <button type="button" onClick={() => setShowStylist(false)} className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Close
              </button>
            </div>
            {stylistLoading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Generating outfit ideas...</p>
            ) : (
              <ul className="space-y-2 text-sm">
                <li className="rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200">
                  Personalized for {selectedColor ?? "your selected color"} / size {selectedSize ?? "your selected size"}
                </li>
                {styleIdeas.map((idea, idx) => (
                  <li key={`${idx}-${idea}`} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
                    {idea}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
      {showPurchaseToast ? (
        <div className="fixed bottom-6 left-6 z-50 max-w-xs rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-white dark:text-zinc-900">
          {purchaseToastText}
        </div>
      ) : null}
    </>
  )
}
