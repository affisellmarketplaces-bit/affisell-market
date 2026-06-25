"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Palette, Ruler, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties } from "react"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { MobileCartCheckoutBar } from "@/components/cart/mobile-cart-checkout-bar"
import { FlexiblePaymentBadge } from "@/components/checkout/flexible-payment-badge"
import { CartCheckoutShippingNote } from "@/components/cart/cart-checkout-shipping-note"
import { CheckoutRegionComingSoonBanner } from "@/components/marketplace/checkout-region-coming-soon-banner"
import { CartRolloutCheckoutNote } from "@/components/marketplace/cart-rollout-checkout-note"
import { useVisitorCheckoutRegion } from "@/hooks/use-visitor-checkout-region"
import { CartCheckoutAutoOpen } from "@/components/cart/cart-checkout-auto-open"
import { COLORS, isMulticolorSwatch } from "@/lib/product-catalog-constants"
import { normalizeCartVariantSignature, parseCartVariantSignature } from "@/lib/cart-variant"
import { guestCartLineId, parseGuestCartLineId } from "@/lib/guest-cart-line-id"
import {
  patchGuestCartItemImageUrl,
  readGuestCart,
  removeGuestCartItem,
  setGuestCartQuantity,
  type GuestCartItem,
} from "@/lib/guest-cart"
import { CartCheckoutIdentitySheet } from "@/components/cart/cart-checkout-identity-sheet"
import { dispatchCartUpdated } from "@/lib/buyer-cart-count-client"
import { mergeGuestBuyerSessionToServer } from "@/lib/merge-guest-cart-client"
import { formatStoreCurrency } from "@/lib/market-config"
import { STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS } from "@/lib/stripe-minimum"

type CartLine = {
  id: string
  qty: number
  sellerName: string | null
  variantSignature: string
  selectedColor: string | null
  selectedSize: string | null
  product: {
    id: string
    title: string
    price: number
    imageUrl: string
  }
}

type AuthSession = {
  user?: { id?: string; role?: string | null } | null
} | null

function normalizeCartRow(raw: CartLine): CartLine {
  return {
    ...raw,
    variantSignature: typeof raw.variantSignature === "string" ? raw.variantSignature : "",
    selectedColor: raw.selectedColor ?? null,
    selectedSize: raw.selectedSize ?? null,
  }
}

async function fetchCart(signal?: AbortSignal): Promise<CartLine[]> {
  const res = await fetch("/api/cart", {
    credentials: "include",
    cache: "no-store",
    signal,
  })
  if (!res.ok) return []
  const data = (await res.json()) as CartLine[]
  return Array.isArray(data) ? data.map(normalizeCartRow) : []
}

async function fetchWithTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms = 4500
): Promise<T> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), ms)
  try {
    return await run(ctrl.signal)
  } finally {
    window.clearTimeout(timer)
  }
}

function guestToLine(item: GuestCartItem): CartLine {
  return {
    id: guestCartLineId(item),
    qty: item.qty,
    sellerName: item.sellerName ?? null,
    variantSignature: normalizeCartVariantSignature(item.selectedColor, item.selectedSize),
    selectedColor: item.selectedColor?.trim() || null,
    selectedSize: item.selectedSize?.trim() || null,
    product: {
      id: item.productId,
      title: item.title || "—",
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
      imageUrl: item.imageUrl || "/placeholder.png",
    },
  }
}

function selectionChips(
  row: CartLine,
  labels: { color: string; size: string }
): { kind: "color" | "size"; label: string; value: string }[] {
  const out: { kind: "color" | "size"; label: string; value: string }[] = []
  if (row.selectedColor?.trim()) {
    out.push({ kind: "color", label: labels.color, value: row.selectedColor.trim() })
  }
  if (row.selectedSize?.trim()) {
    out.push({ kind: "size", label: labels.size, value: row.selectedSize.trim() })
  }
  if (out.length > 0) return out
  const p = parseCartVariantSignature(row.variantSignature)
  if (p.color) out.push({ kind: "color", label: labels.color, value: p.color })
  if (p.size) out.push({ kind: "size", label: labels.size, value: p.size })
  return out
}

/** Visual accent for the product frame from selected color name. */
function colorFrameStyle(color: string | null | undefined): CSSProperties {
  const raw = color?.trim()
  if (!raw) {
    return {
      boxShadow: "0 0 0 2px rgba(139, 92, 246, 0.35), 0 18px 40px -16px rgba(139, 92, 246, 0.25)",
    }
  }
  const c = COLORS.find((x) => x.name.toLowerCase() === raw.toLowerCase())
  if (!c || isMulticolorSwatch(c)) {
    return {
      background: "linear-gradient(135deg, rgba(236,72,153,0.35), rgba(99,102,241,0.35))",
      boxShadow: "0 0 0 2px rgba(168, 85, 247, 0.45), 0 20px 44px -18px rgba(168, 85, 247, 0.35)",
    }
  }
  const hex = c.hex
  return {
    boxShadow: `0 0 0 2px ${hex}cc, 0 20px 44px -18px ${hex}55`,
  }
}

async function fetchSession(signal?: AbortSignal): Promise<AuthSession> {
  const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store", signal })
  if (!res.ok) return null
  return (await res.json().catch(() => null)) as AuthSession
}

export default function CartPage() {
  const t = useTranslations("cart")
  const router = useRouter()
  const { country: visitorCountry, checkoutAvailable, loading: visitorRegionLoading } =
    useVisitorCheckoutRegion()
  const checkoutBlocked = Boolean(visitorCountry && !checkoutAvailable)
  const [lines, setLines] = useState<CartLine[]>([])
  const [isAuthed, setIsAuthed] = useState(false)
  const [isCustomerBuyer, setIsCustomerBuyer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [rewardBalanceCents, setRewardBalanceCents] = useState(0)
  const [useRewardCents, setUseRewardCents] = useState(0)
  const guestImagesResolvedKey = useRef("")
  const selectionLabels = useMemo(
    () => ({ color: t("colorLabel"), size: t("sizeLabel") }),
    [t]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (!url.searchParams.has("cat")) return
    url.searchParams.delete("cat")
    const next = `${url.pathname}${url.search}${url.hash}`
    router.replace(next)
  }, [router])

  useEffect(() => {
    const guestLines = readGuestCart().map(guestToLine)
    if (guestLines.length > 0) {
      setLines(guestLines)
      setLoading(false)
    }

    const ac = new AbortController()
    void (async () => {
      try {
        const [session, serverLines] = await fetchWithTimeout((signal) =>
          Promise.all([fetchSession(signal), fetchCart(signal)])
        )
        if (ac.signal.aborted) return
        const authed = Boolean(session?.user?.id)
        const customerBuyer = authed && session?.user?.role === "CUSTOMER"
        setIsAuthed(authed)
        setIsCustomerBuyer(customerBuyer)
        if (customerBuyer && session?.user?.id) {
          const br = await fetchWithTimeout(
            (signal) =>
              fetch("/api/account/buyer-reward-balance", {
                credentials: "include",
                cache: "no-store",
                signal,
              }),
            3500
          )
          if (br.ok) {
            const j = (await br.json()) as { balanceCents?: number }
            const bal = Math.max(0, Math.round(Number(j.balanceCents) || 0))
            setRewardBalanceCents(bal)
            setUseRewardCents(0)
          }
        } else {
          setRewardBalanceCents(0)
          setUseRewardCents(0)
        }
        const mergedGuest = readGuestCart().map(guestToLine)
        setLines(authed ? [...serverLines, ...mergedGuest] : mergedGuest)
      } catch {
        if (!ac.signal.aborted) setLines(readGuestCart().map(guestToLine))
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [])

  const refreshCart = useCallback(async () => {
    try {
      const [session, serverLines] = await Promise.all([fetchSession(), fetchCart()])
      const authed = Boolean(session?.user?.id)
      const customerBuyer = authed && session?.user?.role === "CUSTOMER"
      setIsAuthed(authed)
      setIsCustomerBuyer(customerBuyer)
      if (customerBuyer && session?.user?.id) {
        const br = await fetch("/api/account/buyer-reward-balance", { credentials: "include", cache: "no-store" })
        if (br.ok) {
          const j = (await br.json()) as { balanceCents?: number }
          setRewardBalanceCents(Math.max(0, Math.round(Number(j.balanceCents) || 0)))
        }
      } else {
        setRewardBalanceCents(0)
        setUseRewardCents(0)
      }
      const guestLines = readGuestCart().map(guestToLine)
      setLines(authed ? [...serverLines, ...guestLines] : guestLines)
    } catch {
      setLines(readGuestCart().map(guestToLine))
    }
  }, [])

  const subtotal = useMemo(
    () => lines.reduce((sum, row) => sum + row.product.price * row.qty, 0),
    [lines]
  )

  const subtotalCents = Math.round(subtotal * 100)
  const minCardCents = STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS
  const MIN_CARD_EUR = minCardCents / 100
  const maxApplicableReward = useMemo(() => {
    if (!isCustomerBuyer || rewardBalanceCents <= 0 || subtotalCents <= 0) return 0
    return Math.max(0, Math.min(rewardBalanceCents, subtotalCents - minCardCents))
  }, [isCustomerBuyer, rewardBalanceCents, minCardCents, subtotalCents])

  const cardChargeCents = Math.max(
    0,
    subtotalCents - Math.min(Math.max(0, Math.round(useRewardCents)), maxApplicableReward)
  )
  const checkoutBelowMinimum = subtotalCents > 0 && cardChargeCents < minCardCents

  const itemCount = useMemo(() => lines.reduce((n, row) => n + row.qty, 0), [lines])

  const guestImageFetchKey = useMemo(
    () =>
      lines
        .filter((l) => l.id.startsWith("guest-") && l.selectedColor?.trim())
        .map((l) => `${l.id}|${l.selectedColor!.trim().toLowerCase()}`)
        .sort()
        .join("~"),
    [lines]
  )

  useEffect(() => {
    if (loading || !guestImageFetchKey) {
      if (!guestImageFetchKey) guestImagesResolvedKey.current = ""
      return
    }
    if (guestImagesResolvedKey.current === guestImageFetchKey) return
    guestImagesResolvedKey.current = guestImageFetchKey

    const ac = new AbortController()
    void (async () => {
      try {
        const targets = lines.filter((l) => l.id.startsWith("guest-") && l.selectedColor?.trim())
        const cache = new Map<string, string>()
        const pairs = await Promise.all(
          targets.map(async (l) => {
            const color = l.selectedColor!.trim()
            const cacheKey = `${l.product.id}|${color.toLowerCase()}`
            if (cache.has(cacheKey)) return { id: l.id, url: cache.get(cacheKey)! }
            const r = await fetch(
              `/api/cart/line-image?listingId=${encodeURIComponent(l.product.id)}&color=${encodeURIComponent(color)}`,
              { signal: ac.signal, cache: "no-store" }
            )
            const j = (await r.json()) as { imageUrl?: string }
            const url = (j.imageUrl?.trim() || l.product.imageUrl || "/placeholder.png").trim()
            cache.set(cacheKey, url)
            return { id: l.id, url }
          })
        )
        if (ac.signal.aborted) return
        for (const p of pairs) {
          const parsed = parseGuestCartLineId(p.id)
          if (parsed) patchGuestCartItemImageUrl(parsed.productId, parsed.variantSignature, p.url)
        }
        const byId = new Map(pairs.map((p) => [p.id, p.url]))
        setLines((prev) =>
          prev.map((row) =>
            byId.has(row.id) && row.product.imageUrl !== byId.get(row.id)
              ? { ...row, product: { ...row.product, imageUrl: byId.get(row.id)! } }
              : row
          )
        )
      } catch {
        /* offline / abort */
      }
    })()
    return () => ac.abort()
  }, [loading, guestImageFetchKey, lines])

  useEffect(() => {
    setUseRewardCents((v) => Math.min(Math.max(0, v), maxApplicableReward))
  }, [maxApplicableReward])

  async function removeItem(itemId: string) {
    if (itemId.startsWith("guest-")) {
      const parsed = parseGuestCartLineId(itemId)
      if (parsed) removeGuestCartItem(parsed.productId, parsed.variantSignature)
      await refreshCart()
      return
    }
    await fetch("/api/cart/remove", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ itemId }),
    })
    await refreshCart()
    dispatchCartUpdated()
  }

  async function setQty(lineId: string, next: number) {
    if (lineId.startsWith("guest-")) {
      const parsed = parseGuestCartLineId(lineId)
      if (parsed) setGuestCartQuantity(parsed.productId, next, parsed.variantSignature)
      await refreshCart()
      return
    }
    await fetch(`/api/cart/items/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quantity: next }),
    })
    await refreshCart()
    dispatchCartUpdated()
  }

  async function proceedToStripe() {
    setCheckoutBusy(true)
    setCheckoutError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.product.id,
            qty: l.qty,
            variantSignature: l.variantSignature || undefined,
            selectedColor: l.selectedColor,
            selectedSize: l.selectedSize,
          })),
          cancelPath: "/cart",
          successPath: "/success?session_id={CHECKOUT_SESSION_ID}&welcome=1",
          useRewardCents: Math.min(Math.max(0, Math.round(useRewardCents)), maxApplicableReward),
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
        return
      }
      if (data.error === "checkout_minimum_not_met") {
        setCheckoutError(t("checkoutMinimumNotMet", { min: MIN_CARD_EUR.toFixed(2) }))
        return
      }
      setCheckoutError(t("checkoutFailed"))
    } finally {
      setCheckoutBusy(false)
    }
  }

  async function checkout() {
    if (lines.length === 0 || checkoutBlocked || checkoutBelowMinimum) return
    if (!isCustomerBuyer) {
      setIdentityOpen(true)
      return
    }
    await proceedToStripe()
  }

  async function afterIdentity() {
    setIdentityOpen(false)
    await mergeGuestBuyerSessionToServer()
    await refreshCart()
    await proceedToStripe()
  }

  if (loading) {
    return (
      <div className="affisell-cart-page min-h-screen bg-gradient-to-b from-zinc-50 to-violet-50/40 py-8 pb-[var(--affisell-mobile-dock-offset)] dark:from-zinc-950 dark:to-violet-950/20 md:pb-8">
        <div className="mx-auto max-w-3xl px-4">
          <div className="animate-pulse space-y-4" aria-busy="true" aria-label={t("loading")}>
            <div className="h-8 w-40 rounded-lg bg-zinc-200/90 dark:bg-zinc-800" />
            <div className="h-28 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/80" />
            <div className="h-28 rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/60" />
          </div>
        </div>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="affisell-cart-page min-h-screen bg-gradient-to-b from-zinc-50 to-violet-50/40 py-8 pb-[var(--affisell-mobile-dock-offset)] dark:from-zinc-950 dark:to-violet-950/20 md:pb-8">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
          <p className="text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
          <Link
            href="/#explorer"
            className="mt-6 inline-flex rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700"
          >
            {t("discoverProducts")}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="affisell-cart-page min-h-screen bg-gradient-to-b from-zinc-50 via-white to-violet-50/30 py-8 pb-[calc(var(--affisell-mobile-dock-offset)+5.25rem)] dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/15 md:pb-8">
      <Suspense fallback={null}>
        <CartCheckoutAutoOpen
          enabled={!loading && !isCustomerBuyer && lines.length > 0}
          onOpen={() => setIdentityOpen(true)}
        />
      </Suspense>
      <div className="mx-auto max-w-3xl px-4">
        {!isCustomerBuyer ? (
          <p className="mb-6 rounded-2xl border border-violet-200/80 bg-violet-50/80 px-4 py-3 text-sm text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-100">
            {t("guestCheckoutHint")}
          </p>
        ) : null}
        {!visitorRegionLoading && checkoutBlocked && visitorCountry ? (
          <CheckoutRegionComingSoonBanner
            className="mb-6"
            variant="compact"
            visitorCountry={visitorCountry}
            checkoutAvailable={false}
          />
        ) : (
          <CartRolloutCheckoutNote />
        )}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("itemCountHint", { count: itemCount })}</p>
          </div>
          <Link
            href="/#explorer"
            className="text-sm font-medium text-violet-700 hover:underline dark:text-violet-400"
          >
            {t("explore")}
          </Link>
        </div>

        <div className="space-y-4">
          {lines.map((row) => {
            const lineTotal = row.product.price * row.qty
            const chips = selectionChips(row, selectionLabels)
            const frameColor =
              row.selectedColor?.trim() || chips.find((c) => c.kind === "color")?.value || null
            return (
              <div
                key={row.id}
                className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_20px_50px_-36px_rgba(15,23,42,0.35)] dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div className="flex gap-4 p-4 sm:p-5">
                  <Link
                    href={`/marketplace/${row.product.id}`}
                    className="relative shrink-0 rounded-xl ring-1 ring-zinc-200/80 transition-[box-shadow,ring-color] duration-300 hover:ring-violet-400/60 dark:ring-zinc-700"
                  >
                    <span
                      className="block overflow-hidden rounded-xl bg-zinc-50 transition-[box-shadow] duration-500 dark:bg-zinc-950"
                      style={colorFrameStyle(frameColor)}
                    >
                      <Image
                        src={row.product.imageUrl || "/placeholder.png"}
                        alt=""
                        width={128}
                        height={128}
                        unoptimized
                        className="h-28 w-28 object-contain p-2 sm:h-32 sm:w-32"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.png"
                        }}
                      />
                    </span>
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-md ring-2 ring-white dark:ring-zinc-900">
                      {row.qty}
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                          {row.product.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {t("bySeller", { seller: row.sellerName || t("verifiedSeller") })}
                        </p>
                      </div>
                      <Link
                        href={`/marketplace/${row.product.id}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-violet-600 dark:hover:text-violet-300"
                      >
                        {t("view")} <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                      </Link>
                    </div>

                    {chips.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50/90 to-fuchsia-50/40 px-3 py-2.5 dark:border-violet-900/40 dark:from-violet-950/40 dark:to-fuchsia-950/20">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          <Sparkles className="h-3 w-3" aria-hidden />
                          {t("yourSelection")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {chips.map((c) => (
                            <span
                              key={`${c.kind}-${c.value}`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100"
                            >
                              {c.kind === "color" ? (
                                <Palette className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
                              ) : (
                                <Ruler className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-400" aria-hidden />
                              )}
                              <span className="text-zinc-500 dark:text-zinc-400">{c.label}</span>
                              {c.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {chips.length === 0 ? (
                      <p className="mt-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                        {t("noColorSize")}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800/80">
                        <button
                          type="button"
                          className="rounded-full px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-white dark:text-zinc-200 dark:hover:bg-zinc-900"
                          onClick={() => void setQty(row.id, row.qty - 1)}
                        >
                          −
                        </button>
                        <span className="min-w-[2.5rem] text-center text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {row.qty}
                        </span>
                        <button
                          type="button"
                          className="rounded-full px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-white dark:text-zinc-200 dark:hover:bg-zinc-900"
                          onClick={() => void setQty(row.id, row.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {formatStoreCurrency(lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void removeItem(row.id)}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          {t("remove")}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-4 flex justify-between text-lg font-bold text-zinc-900 dark:text-zinc-50">
            <span>
              {t("subtotal", { count: itemCount })}
            </span>
            <span className="tabular-nums">{formatStoreCurrency(subtotal)}</span>
          </div>
          {isCustomerBuyer && rewardBalanceCents > 0 ? (
            <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">{t("cashbackAvailable")}</p>
              <p className="mt-1 text-xs text-teal-800 dark:text-teal-200/90">
                {t("balanceUpToUsable", {
                  balance: formatStoreCurrency(rewardBalanceCents / 100),
                  usable: formatStoreCurrency(maxApplicableReward / 100),
                  minCard: MIN_CARD_EUR.toFixed(2),
                })}
              </p>
              <label htmlFor="use-reward" className="mt-3 block text-xs font-medium text-teal-900 dark:text-teal-100">
                {t("applyAtCheckout")}
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <input
                  id="use-reward"
                  type="range"
                  min={0}
                  max={maxApplicableReward}
                  step={1}
                  value={Math.min(useRewardCents, maxApplicableReward)}
                  onChange={(e) => setUseRewardCents(Number(e.target.value))}
                  className="min-w-[12rem] flex-1 accent-teal-600"
                />
                <span className="text-sm font-semibold text-teal-900 dark:text-teal-50">
                  {formatStoreCurrency(Math.min(useRewardCents, maxApplicableReward) / 100)}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-700 dark:bg-zinc-900 dark:text-teal-100"
                  onClick={() => setUseRewardCents(maxApplicableReward)}
                >
                  {t("max")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-700 dark:bg-zinc-900 dark:text-teal-100"
                  onClick={() => setUseRewardCents(0)}
                >
                  {t("none")}
                </button>
              </div>
            </div>
          ) : null}
          <CartCheckoutShippingNote />
          {checkoutBelowMinimum ? (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {t("checkoutMinimumNotMet", { min: MIN_CARD_EUR.toFixed(2) })}
            </p>
          ) : null}
          {checkoutError ? (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
              {checkoutError}
            </p>
          ) : null}
          {!isCustomerBuyer ? (
            <p className="mb-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {t("emailOrPhoneBeforePayment")}
            </p>
          ) : null}
          <div className="mb-4 flex justify-center sm:justify-start">
            <FlexiblePaymentBadge amountCents={subtotalCents} />
          </div>
          <button
            type="button"
            disabled={checkoutBusy || checkoutBlocked || checkoutBelowMinimum}
            onClick={() => void checkout()}
            className="mb-3 hidden w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60 md:block"
          >
            {checkoutBusy ? t("redirecting") : checkoutBlocked ? t("checkoutRegionBlocked") : t("validatePurchase")}
          </button>
          <Link
            href="/#explorer"
            className="flex w-full items-center justify-center rounded-full border-2 border-zinc-900 py-3 text-center text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            {t("continueShopping")}
          </Link>
        </div>
        <CartCheckoutIdentitySheet
          open={identityOpen}
          onClose={() => setIdentityOpen(false)}
          onIdentified={afterIdentity}
        />
      </div>
      <MobileCartCheckoutBar
        totalLabel={t("subtotal", { count: itemCount })}
        totalFormatted={formatStoreCurrency(subtotal)}
        ctaLabel={checkoutBlocked ? t("checkoutRegionBlocked") : t("validatePurchase")}
        busyLabel={t("redirecting")}
        disabled={checkoutBlocked || checkoutBelowMinimum || lines.length === 0}
        busy={checkoutBusy}
        onCheckout={() => void checkout()}
      />
    </div>
  )
}
