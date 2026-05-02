"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

type CartLine = {
  id: string
  qty: number
  product: {
    id: string
    title: string
    price: number
    imageUrl: string
  }
}

async function fetchCart(signal?: AbortSignal): Promise<CartLine[]> {
  const res = await fetch("/api/cart", { credentials: "include", cache: "no-store", signal })
  const data = (await res.json()) as CartLine[]
  return Array.isArray(data) ? data : []
}

export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        const data = await fetchCart(ac.signal)
        if (!ac.signal.aborted) setLines(data)
      } catch {
        if (!ac.signal.aborted) setLines([])
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [])

  const refreshCart = useCallback(async () => {
    try {
      const data = await fetchCart()
      setLines(data)
    } catch {
      setLines([])
    }
  }, [])

  const subtotal = useMemo(
    () => lines.reduce((sum, row) => sum + row.product.price * row.qty, 0),
    [lines]
  )

  async function setQty(lineId: string, next: number) {
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
    setCheckoutBusy(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
          cancelPath: "/cart",
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
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-zinc-500">Loading cart…</p>
      </main>
    )
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Cart</h1>
        <p className="mt-4 text-zinc-600">Your cart is empty</p>
        <Link href="/marketplace" className="mt-4 inline-block text-sm font-medium underline">
          Continue shopping
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Cart</h1>

      <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
        {lines.map((row) => (
          <li key={row.id} className="flex gap-4 py-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
              <img
                src={row.product.imageUrl || "/placeholder.png"}
                alt=""
                className="max-h-20 max-w-20 object-contain"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.png"
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{row.product.title}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {row.product.price.toLocaleString("en-US", { style: "currency", currency: "EUR" })} each
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-sm"
                  onClick={() => void setQty(row.id, row.qty - 1)}
                >
                  −
                </button>
                <span className="min-w-[2ch] text-center text-sm">{row.qty}</span>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-sm"
                  onClick={() => void setQty(row.id, row.qty + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-lg font-semibold">
        Subtotal:{" "}
        {subtotal.toLocaleString("en-US", {
          style: "currency",
          currency: "EUR",
        })}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/marketplace"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
        >
          Continue shopping
        </Link>
        <button
          type="button"
          disabled={checkoutBusy}
          onClick={() => void checkout()}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {checkoutBusy ? "Redirecting…" : "Checkout"}
        </button>
      </div>
    </main>
  )
}
