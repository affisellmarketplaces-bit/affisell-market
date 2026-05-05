"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  readGuestCart,
  removeGuestCartItem,
  setGuestCartQuantity,
  type GuestCartItem,
} from "@/lib/guest-cart"

type CartLine = {
  id: string
  qty: number
  sellerName: string | null
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

function formatEur(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

async function fetchCart(signal?: AbortSignal): Promise<CartLine[]> {
  const res = await fetch("/api/cart", { credentials: "include", cache: "no-store", signal })
  const data = (await res.json()) as CartLine[]
  return Array.isArray(data) ? data : []
}

function guestToLine(item: GuestCartItem): CartLine {
  return {
    id: `guest-${item.productId}`,
    qty: item.qty,
    sellerName: item.sellerName ?? null,
    product: {
      id: item.productId,
      title: item.title || "Product",
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
      imageUrl: item.imageUrl || "/placeholder.png",
    },
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

  const itemCount = useMemo(() => lines.reduce((n, row) => n + row.qty, 0), [lines])

  async function removeItem(itemId: string) {
    if (itemId.startsWith("guest-")) {
      removeGuestCartItem(itemId.replace("guest-", ""))
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
      setGuestCartQuantity(lineId.replace("guest-", ""), next)
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
      window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent("/cart")}`
      return
    }
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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-sm text-gray-500">Loading cart…</p>
        </div>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-600">Your cart is empty</p>
          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Shopping Cart</h1>

        {lines.map((row) => {
          const lineTotal = row.product.price * row.qty
          return (
            <div
              key={row.id}
              className="mb-4 flex gap-4 rounded-xl bg-white p-4 shadow-sm"
            >
              <img
                src={row.product.imageUrl || "/placeholder.png"}
                alt=""
                className="h-24 w-24 flex-shrink-0 rounded-lg bg-gray-50 object-contain"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.png"
                }}
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-900">{row.product.title}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  by {row.sellerName || "Verified Seller"}
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 px-2 py-1 font-medium hover:bg-gray-50"
                    onClick={() => void setQty(row.id, row.qty - 1)}
                  >
                    −
                  </button>
                  <span className="min-w-[2ch] text-center">{row.qty}</span>
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 px-2 py-1 font-medium hover:bg-gray-50"
                    onClick={() => void setQty(row.id, row.qty + 1)}
                  >
                    +
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">{formatEur(lineTotal)}</span>
                  <button
                    type="button"
                    onClick={() => void removeItem(row.id)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
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
          )
        })}

        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex justify-between text-lg font-semibold text-gray-900">
            <span>
              Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
            <span>{formatEur(subtotal)}</span>
          </div>
          <button
            type="button"
            disabled={checkoutBusy}
            onClick={() => void checkout()}
            className="mb-3 w-full rounded-xl bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {checkoutBusy ? "Redirecting…" : "Proceed to Checkout"}
          </button>
          <Link
            href="/marketplace"
            className="flex w-full items-center justify-center rounded-xl bg-green-600 py-3 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
