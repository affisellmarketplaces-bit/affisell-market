"use client"

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"

import { normalizeCartVariantSignature } from "@/lib/cart-variant"
import { readGuestCart, type GuestCartItem } from "@/lib/guest-cart"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CartLine = {
  affiliateProductId: string
  qty: number
  variantSignature: string
  title: string
}

type AuthSession = { user?: { id?: string } | null } | null

async function fetchSession(): Promise<AuthSession> {
  const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
  if (!res.ok) return null
  return (await res.json().catch(() => null)) as AuthSession
}

type ServerCartRow = {
  qty: number
  variantSignature: string
  product: { id: string; title: string }
}

async function fetchServerCart(): Promise<ServerCartRow[]> {
  const res = await fetch("/api/cart", { credentials: "include", cache: "no-store" })
  if (!res.ok) return []
  const data = (await res.json()) as ServerCartRow[]
  return Array.isArray(data) ? data : []
}

function guestToLine(item: GuestCartItem): CartLine {
  return {
    affiliateProductId: item.productId,
    qty: item.qty,
    variantSignature: normalizeCartVariantSignature(item.selectedColor, item.selectedSize),
    title: item.title || "Product",
  }
}

function serverToLine(row: ServerCartRow): CartLine {
  return {
    affiliateProductId: row.product.id,
    qty: row.qty,
    variantSignature: typeof row.variantSignature === "string" ? row.variantSignature : "",
    title: row.product.title,
  }
}

const stripePk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""

function BlindPaymentForm({ blindOrderId }: { blindOrderId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!stripe || !elements) return
    setBusy(true)
    try {
      const origin = window.location.origin
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${origin}/order-success?blindOrderId=${encodeURIComponent(blindOrderId)}`,
        },
      })
      if (error) setErr(error.message ?? "Payment failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      <button
        type="submit"
        disabled={busy || !stripe}
        className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }), "w-full justify-center")}
      >
        {busy ? "Processing…" : "Pay securely"}
      </button>
    </form>
  )
}

export default function BlindCheckoutPage() {
  const [lines, setLines] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [eligibility, setEligibility] = useState<{ ok: boolean; message?: string } | null>(null)
  const [customerEmail, setCustomerEmail] = useState("")
  const [shipping, setShipping] = useState({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "FR",
    phone: "",
  })
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [blindOrderId, setBlindOrderId] = useState<string | null>(null)
  const [stepBusy, setStepBusy] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  const stripePromise = useMemo(() => (stripePk ? loadStripe(stripePk) : null), [])

  const refreshLines = useCallback(async () => {
    const session = await fetchSession()
    const guestLines = readGuestCart().map(guestToLine)
    if (session?.user?.id) {
      const server = await fetchServerCart()
      setLines([...server.map(serverToLine), ...guestLines])
    } else {
      setLines(guestLines)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refreshLines()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [refreshLines])

  useEffect(() => {
    if (lines.length === 0) {
      setEligibility(null)
      return
    }
    const ac = new AbortController()
    ;(async () => {
      const res = await fetch("/api/checkout/blind-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ affiliateProductId: l.affiliateProductId, qty: l.qty })),
        }),
        signal: ac.signal,
      })
      const data = (await res.json()) as { allEligible?: boolean; lines?: { eligible: boolean; reason?: string }[] }
      if (ac.signal.aborted) return
      if (!res.ok) {
        setEligibility({ ok: false, message: "Could not validate blind dropship eligibility" })
        return
      }
      if (!data.allEligible) {
        const bad = data.lines?.find((x) => !x.eligible)
        setEligibility({ ok: false, message: bad?.reason ?? "Some items are not blind-dropship ready" })
      } else {
        setEligibility({ ok: true })
      }
    })()
    return () => ac.abort()
  }, [lines])

  async function createPaymentIntent(e: FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (!eligibility?.ok) {
      setFormErr("Cart is not eligible for blind checkout")
      return
    }
    if (!customerEmail.includes("@")) {
      setFormErr("Valid email required")
      return
    }
    if (!shipping.name.trim() || !shipping.line1.trim() || !shipping.city.trim() || !shipping.postal_code.trim()) {
      setFormErr("Shipping name, address, city, and postal code are required")
      return
    }
    setStepBusy(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          checkoutMode: "blind_dropship",
          customerEmail: customerEmail.trim(),
          shipping: {
            name: shipping.name.trim(),
            line1: shipping.line1.trim(),
            line2: shipping.line2.trim() || undefined,
            city: shipping.city.trim(),
            state: shipping.state.trim() || undefined,
            postal_code: shipping.postal_code.trim(),
            country: shipping.country.trim().toUpperCase().slice(0, 2),
            phone: shipping.phone.trim() || undefined,
          },
          items: lines.map((l) => ({
            affiliateProductId: l.affiliateProductId,
            qty: l.qty,
          })),
        }),
      })
      const data = (await res.json()) as { clientSecret?: string; blindDropshipOrderId?: string; error?: string }
      if (!res.ok) {
        setFormErr(data.error ?? `Error ${res.status}`)
        return
      }
      if (!data.clientSecret || !data.blindDropshipOrderId) {
        setFormErr("Missing payment session from server")
        return
      }
      setClientSecret(data.clientSecret)
      setBlindOrderId(data.blindDropshipOrderId)
    } finally {
      setStepBusy(false)
    }
  }

  if (!stripePk) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="text-sm text-red-600 dark:text-red-400">
          Missing <code className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>. Add it to enable blind
          checkout.
        </p>
        <Link href="/cart" className="mt-4 inline-block text-violet-700 underline dark:text-violet-400">
          ← Back to cart
        </Link>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="text-zinc-600 dark:text-zinc-400">Loading cart…</p>
      </main>
    )
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Blind checkout</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Your cart is empty.</p>
        <Link href="/cart" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "mt-6 inline-flex")}>
          Go to cart
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            Blind dropship
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Secure checkout</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            All items must have supplier SKU + wholesale on the catalog. Partner APIs never see your retail price.
          </p>
        </div>
        <Link href="/cart" className="text-sm font-medium text-violet-700 hover:underline dark:text-violet-400">
          ← Cart
        </Link>
      </div>

      <ul className="mb-6 space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        {lines.map((l) => (
          <li key={`${l.affiliateProductId}::${l.variantSignature}`} className="flex justify-between gap-2">
            <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{l.title}</span>
            <span className="shrink-0 text-zinc-500">×{l.qty}</span>
          </li>
        ))}
      </ul>

      {eligibility && !eligibility.ok ? (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Cannot use blind checkout: {eligibility.message}. Update catalog (SKU + wholesale) and supplier blind profile,
          or use{" "}
          <Link href="/cart" className="font-medium underline">
            standard cart checkout
          </Link>
          .
        </p>
      ) : null}

      {!clientSecret ? (
        <form onSubmit={(e) => void createPaymentIntent(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Email</label>
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Full name</label>
              <input
                value={shipping.name}
                onChange={(e) => setShipping((s) => ({ ...s, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Address line 1</label>
              <input
                value={shipping.line1}
                onChange={(e) => setShipping((s) => ({ ...s, line1: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Address line 2 (optional)</label>
              <input
                value={shipping.line2}
                onChange={(e) => setShipping((s) => ({ ...s, line2: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">City</label>
              <input
                value={shipping.city}
                onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Postal code</label>
              <input
                value={shipping.postal_code}
                onChange={(e) => setShipping((s) => ({ ...s, postal_code: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Country (ISO-2)</label>
              <input
                value={shipping.country}
                onChange={(e) => setShipping((s) => ({ ...s, country: e.target.value.toUpperCase().slice(0, 2) }))}
                maxLength={2}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Phone (optional)</label>
              <input
                value={shipping.phone}
                onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          </div>
          {formErr ? <p className="text-sm text-red-600 dark:text-red-400">{formErr}</p> : null}
          <button
            type="submit"
            disabled={!eligibility?.ok || stepBusy}
            className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "w-full justify-center")}
          >
            {stepBusy ? "Preparing payment…" : "Continue to payment"}
          </button>
        </form>
      ) : stripePromise && blindOrderId ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: "stripe", variables: { colorPrimary: "#7c3aed" } },
          }}
        >
          <BlindPaymentForm blindOrderId={blindOrderId} />
        </Elements>
      ) : null}
    </main>
  )
}
