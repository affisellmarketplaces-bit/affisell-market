"use client"

import Image from "next/image"
import Link from "next/link"
import { ExternalLink, Palette, Ruler, Sparkles } from "lucide-react"
import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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
import { formatStoreCurrency } from "@/lib/market-config"

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
  const res = await fetch("/api/cart", { credentials: "include", cache: "no-store", signal })
  const data = (await res.json()) as CartLine[]
  return Array.isArray(data) ? data.map(normalizeCartRow) : []
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
      title: item.title || "Product",
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
      imageUrl: item.imageUrl || "/placeholder.png",
    },
  }
}

function selectionChips(row: CartLine): { kind: "color" | "size"; label: string; value: string }[] {
  const out: { kind: "color" | "size"; label: string; value: string }[] = []
  if (row.selectedColor?.trim()) {
    out.push({ kind: "color", label: "Color", value: row.selectedColor.trim() })
  }
  if (row.selectedSize?.trim()) {
    out.push({ kind: "size", label: "Size", value: row.selectedSize.trim() })
  }
  if (out.length > 0) return out
  const p = parseCartVariantSignature(row.variantSignature)
  if (p.color) out.push({ kind: "color", label: "Color", value: p.color })
  if (p.size) out.push({ kind: "size", label: "Size", value: p.size })
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
  const [lines, setLines] = useState<CartLine[]>([])
  const [isAuthed, setIsAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [rewardBalanceCents, setRewardBalanceCents] = useState(0)
  const [useRewardCents, setUseRewardCents] = useState(0)
  const guestImagesResolvedKey = useRef("")

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        const [session, serverLines] = await Promise.all([
          fetchSession(ac.signal),
          fetchCart(ac.signal),
        ])
        if (ac.signal.aborted) return
        const authed = Boolean(session?.user?.id)
        setIsAuthed(authed)
        if (authed && session?.user?.id) {
          const br = await fetch("/api/account/buyer-reward-balance", {
            credentials: "include",
            cache: "no-store",
            signal: ac.signal,
          })
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
        const guestLines = readGuestCart().map(guestToLine)
        setLines(authed ? [...serverLines, ...guestLines] : guestLines)
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
      setIsAuthed(authed)
      if (authed && session?.user?.id) {
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
  const MIN_CARD_EUR = 0.5
  const minCardCents = Math.round(MIN_CARD_EUR * 100)
  const maxApplicableReward = useMemo(() => {
    if (!isAuthed || rewardBalanceCents <= 0 || subtotalCents <= 0) return 0
    return Math.max(0, Math.min(rewardBalanceCents, subtotalCents - minCardCents))
  }, [isAuthed, rewardBalanceCents, minCardCents, subtotalCents])

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
  }

  async function checkout() {
    if (lines.length === 0) return
    if (!isAuthed) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent("/cart")}`
      return
    }
    setCheckoutBusy(true)
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
          useRewardCents: Math.min(Math.max(0, Math.round(useRewardCents)), maxApplicableReward),
        }),
      })
      const data = (await res.json()) as { url?: string }
      if (data.url) window.location.href = data.url
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-violet-50/40 py-8 dark:from-zinc-950 dark:to-violet-950/20">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-sm text-zinc-500">Loading cart…</p>
        </div>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-violet-50/40 py-8 dark:from-zinc-950 dark:to-violet-950/20">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Shopping Cart</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Your cart is empty</p>
          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-violet-50/30 py-8 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/15">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Shopping Cart</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {itemCount} {itemCount === 1 ? "piece" : "pieces"} · selections follow you to checkout
            </p>
          </div>
          <Link
            href="/marketplace"
            className="text-sm font-medium text-violet-700 hover:underline dark:text-violet-400"
          >
            ← Marketplace
          </Link>
        </div>

        <div className="space-y-4">
          {lines.map((row) => {
            const lineTotal = row.product.price * row.qty
            const chips = selectionChips(row)
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
                          by {row.sellerName || "Verified Seller"}
                        </p>
                      </div>
                      <Link
                        href={`/marketplace/${row.product.id}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-violet-600 dark:hover:text-violet-300"
                      >
                        View <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                      </Link>
                    </div>

                    {chips.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50/90 to-fuchsia-50/40 px-3 py-2.5 dark:border-violet-900/40 dark:from-violet-950/40 dark:to-fuchsia-950/20">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          <Sparkles className="h-3 w-3" aria-hidden />
                          Your selection
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
                        No color or size recorded for this line — pick options on the product page when you add to
                        cart.
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
                          Remove
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
              Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
            <span className="tabular-nums">{formatStoreCurrency(subtotal)}</span>
          </div>
          {isAuthed && rewardBalanceCents > 0 ? (
            <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">Store credit</p>
              <p className="mt-1 text-xs text-teal-800 dark:text-teal-200/90">
                Balance {formatStoreCurrency(rewardBalanceCents / 100)} · up to{" "}
                {formatStoreCurrency(maxApplicableReward / 100)} usable
                (€{MIN_CARD_EUR.toFixed(2)} minimum card charge stays on the order).
              </p>
              <label htmlFor="use-reward" className="mt-3 block text-xs font-medium text-teal-900 dark:text-teal-100">
                Apply at checkout (EUR)
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
                  Max
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-700 dark:bg-zinc-900 dark:text-teal-100"
                  onClick={() => setUseRewardCents(0)}
                >
                  None
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            disabled={checkoutBusy}
            onClick={() => void checkout()}
            className="mb-3 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
          >
            {checkoutBusy ? "Redirecting…" : "Proceed to Checkout"}
          </button>
          <Link
            href="/marketplace"
            className="flex w-full items-center justify-center rounded-full border-2 border-zinc-900 py-3 text-center text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
