"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  guestCartCount,
  readGuestCart,
  removeGuestCartItem,
  setGuestCartQuantity,
  type CartAddedEventDetail,
} from "@/lib/guest-cart"

type ToastState = {
  productId: string
  productName: string
  qtyAdded: number
} | null

export function SiteNav() {
  const [count, setCount] = useState(0)
  const [bounce, setBounce] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setCount(guestCartCount())

    function onUpdated() {
      setCount(guestCartCount())
      setBounce(true)
      window.setTimeout(() => setBounce(false), 420)
    }

    function onAdded(ev: Event) {
      const detail = (ev as CustomEvent<CartAddedEventDetail>).detail
      if (!detail) return
      setToast({
        productId: detail.productId,
        productName: detail.productName,
        qtyAdded: detail.qtyAdded,
      })
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000)
    }

    window.addEventListener("affisell:cart-updated", onUpdated)
    window.addEventListener("affisell:cart-added", onAdded as EventListener)
    return () => {
      window.removeEventListener("affisell:cart-updated", onUpdated)
      window.removeEventListener("affisell:cart-added", onAdded as EventListener)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  function undoLastAdd() {
    if (!toast) return
    const rows = readGuestCart()
    const row = rows.find((r) => r.productId === toast.productId)
    if (!row) {
      setToast(null)
      return
    }
    const nextQty = row.qty - toast.qtyAdded
    if (nextQty <= 0) removeGuestCartItem(toast.productId)
    else setGuestCartQuantity(toast.productId, nextQty)
    setToast(null)
  }

  return (
    <>
      <nav className="mx-auto flex max-w-6xl items-center justify-end gap-6 text-sm">
        <Link href="/agent" className="text-zinc-700 hover:underline dark:text-zinc-300">
          Agent
        </Link>
        <Link href="/marketplace" className="text-zinc-700 hover:underline dark:text-zinc-300">
          Marketplace
        </Link>
        <Link href="/cart" className="relative inline-flex items-center gap-1.5 text-zinc-700 hover:underline dark:text-zinc-300">
          <ShoppingCart className={`h-4 w-4 ${bounce ? "animate-bounce" : ""}`} />
          Cart
          {count > 0 ? (
            <span className="absolute -right-3 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {count}
            </span>
          ) : null}
        </Link>
      </nav>

      {toast ? (
        <div className="fixed right-4 top-4 z-[100] rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-zinc-100 dark:text-zinc-900">
          <p>
            Added to cart — <span className="font-semibold">{toast.productName}</span>
          </p>
          <button
            type="button"
            onClick={undoLastAdd}
            className="mt-1 text-xs font-medium underline underline-offset-2 hover:opacity-80"
          >
            Undo
          </button>
        </div>
      ) : null}
    </>
  )
}
