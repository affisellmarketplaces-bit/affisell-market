"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Camera, Search, ShoppingCart, Wallet } from "lucide-react"
import { motion } from "framer-motion"
import type { FormEvent } from "react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useSession } from "next-auth/react"

import {
  guestCartCount,
  readGuestCart,
  removeGuestCartItem,
  setGuestCartQuantity,
  type CartAddedEventDetail,
} from "@/lib/guest-cart"
import { normalizeCartVariantSignature } from "@/lib/cart-variant"
import { MerchantAccountNavActions } from "@/components/merchant-account-nav-actions"
import { SupplierNotificationsMenu } from "@/components/supplier/supplier-notifications-menu"
import { buttonVariants } from "@/components/ui/button"
import { VisualSearchModal } from "@/components/visual-search-modal"
import { showBuyerCommerceInSiteHeader } from "@/lib/buyer-commerce"
import { cn } from "@/lib/utils"

function subscribeGuestCart(listener: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("affisell:cart-updated", listener)
  window.addEventListener("affisell:cart-added", listener)
  return () => {
    window.removeEventListener("affisell:cart-updated", listener)
    window.removeEventListener("affisell:cart-added", listener)
  }
}

type ToastState = {
  productId: string
  productName: string
  qtyAdded: number
  variantSignature: string
} | null

export function SiteNav() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isAuthRoute =
    pathname?.startsWith("/auth/") || pathname === "/login" || pathname?.startsWith("/signup")

  const isSupplier = session?.user?.role === "SUPPLIER"
  const isAffiliate = session?.user?.role === "AFFILIATE"
  const showAffiliateMerchantActions = Boolean(isAffiliate && pathname?.startsWith("/dashboard"))
  const role = session?.user?.role
  const showBuyerHeaderCommerce = showBuyerCommerceInSiteHeader(pathname, role, Boolean(session?.user))
  const router = useRouter()
  const searchParams = useSearchParams()
  const marketplaceSearchKey =
    pathname === "/marketplace" ? `marketplace-${searchParams.toString()}` : `nav-${pathname}`

  const count = useSyncExternalStore(subscribeGuestCart, guestCartCount, () => 0)
  const [bounce, setBounce] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const toastTimerRef = useRef<number | null>(null)
  const [visualOpen, setVisualOpen] = useState(false)

  useEffect(() => {
    let bounceTimer = 0

    function onCartChanged() {
      if (bounceTimer) window.clearTimeout(bounceTimer)
      setBounce(true)
      bounceTimer = window.setTimeout(() => setBounce(false), 420)
    }

    function onAdded(ev: Event) {
      const detail = (ev as CustomEvent<CartAddedEventDetail>).detail
      if (!detail) return
      setToast({
        productId: detail.productId,
        productName: detail.productName,
        qtyAdded: detail.qtyAdded,
        variantSignature: detail.variantSignature,
      })
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000)
    }

    window.addEventListener("affisell:cart-updated", onCartChanged)
    window.addEventListener("affisell:cart-added", onCartChanged)
    window.addEventListener("affisell:cart-added", onAdded as EventListener)
    return () => {
      window.removeEventListener("affisell:cart-updated", onCartChanged)
      window.removeEventListener("affisell:cart-added", onCartChanged)
      window.removeEventListener("affisell:cart-added", onAdded as EventListener)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      if (bounceTimer) window.clearTimeout(bounceTimer)
    }
  }, [])

  function undoLastAdd() {
    if (!toast) return
    const rows = readGuestCart()
    const row = rows.find(
      (r) =>
        r.productId === toast.productId &&
        normalizeCartVariantSignature(r.selectedColor, r.selectedSize) === toast.variantSignature
    )
    if (!row) {
      setToast(null)
      return
    }
    const nextQty = row.qty - toast.qtyAdded
    if (nextQty <= 0) removeGuestCartItem(toast.productId, toast.variantSignature)
    else setGuestCartQuantity(toast.productId, nextQty, toast.variantSignature)
    setToast(null)
  }

  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== "/" || ev.ctrlKey || ev.metaKey || ev.altKey) return
      const el = ev.target as HTMLElement | null
      if (!el) return
      if (el.closest("input, textarea, select, [contenteditable=true]")) return
      ev.preventDefault()
      document.getElementById("header-search-q")?.focus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  if (isSupplier && !isAuthRoute) {
    return (
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-1 py-1 text-sm md:flex-nowrap md:gap-4">
        <Link
          href="/dashboard/supplier"
          className="order-1 shrink-0 text-lg font-bold affisell-logo-text"
        >
          Affisell
        </Link>
        <span className="order-2 shrink-0 rounded-full bg-supplier-muted px-2 py-0.5 text-xs font-semibold text-supplier">
          Supplier
        </span>
        <motion.div
          layout
          className="order-3 flex w-full flex-wrap items-center justify-end gap-2 md:ml-auto md:w-auto"
        >
          <Link
            href="/dashboard/supplier/orders"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Orders to ship
          </Link>
          <Link
            href="/dashboard/supplier/balance"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Balance &amp; sales
          </Link>
          <SupplierNotificationsMenu />
          <MerchantAccountNavActions />
        </motion.div>
      </nav>
    )
  }

  function submitHeaderSearch(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const q = String(fd.get("q") ?? "").trim()
    const params = new URLSearchParams(searchParams.toString())
    if (pathname === "/marketplace") {
      if (q) params.set("q", q)
      else params.delete("q")
      const s = params.toString()
      router.push(`/marketplace${s ? `?${s}` : ""}`)
    } else {
      const usp = new URLSearchParams()
      if (q) usp.set("q", q)
      router.push(`/marketplace${usp.toString() ? `?${usp}` : ""}`)
    }
  }

  return (
    <>
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-1 py-1 text-sm md:flex-nowrap md:gap-4">
        <Link href="/" className="order-1 shrink-0 text-lg font-bold affisell-logo-text">
          Affisell
        </Link>

        <form
          className="order-3 flex min-w-0 flex-1 items-center gap-2 md:order-2"
          onSubmit={submitHeaderSearch}
          role="search"
        >
          <div className="relative flex min-w-0 flex-1 items-center">
            <label htmlFor="header-search-q" className="sr-only">
              Search marketplace
            </label>
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" aria-hidden />
            <input
              id="header-search-q"
              key={marketplaceSearchKey}
              name="q"
              type="search"
              defaultValue={pathname === "/marketplace" ? (searchParams.get("q") ?? "") : ""}
              placeholder="Search marketplace…"
              title="Tip: press / to jump here"
              autoComplete="off"
              className="h-10 w-full min-w-0 rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-12 text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 md:max-w-xl lg:max-w-2xl"
            />
            <button
              type="button"
              onClick={() => setVisualOpen(true)}
              title="Visual search — find similar products with a photo"
              aria-label="Open AI visual search"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-600 transition hover:bg-violet-100 hover:text-violet-700 dark:text-zinc-400 dark:hover:bg-violet-950 dark:hover:text-violet-300"
            >
              <Camera className="h-5 w-5 shrink-0" aria-hidden />
            </button>
          </div>
        </form>

        <div className="order-2 flex shrink-0 flex-wrap items-center gap-4 md:order-3 md:gap-6">
          <Link
            href="/agent"
            className="font-medium text-brand hover:text-brand-hover hover:underline dark:text-brand-light dark:hover:text-brand-light"
          >
            Agent
          </Link>
          <Link href="/marketplace" className="text-zinc-700 hover:underline dark:text-zinc-300">
            Marketplace
          </Link>
          {showBuyerHeaderCommerce ? (
            <>
              <Link href="/marketplace/account/orders" className="text-zinc-700 hover:underline dark:text-zinc-300">
                Orders
              </Link>
              <Link href="/marketplace/account/wallet" className="text-zinc-700 hover:underline dark:text-zinc-300">
                Wallet
              </Link>
              <Link
                href="/cart"
                className="relative inline-flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
              >
                <ShoppingCart className={`h-4 w-4 ${bounce ? "animate-bounce" : ""}`} />
                Cart
                {count > 0 ? (
                  <span className="absolute -right-3 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {count}
                  </span>
                ) : null}
              </Link>
            </>
          ) : null}
          {showAffiliateMerchantActions ? (
            <div className="flex w-full basis-full flex-wrap justify-end gap-2 pt-1 md:ml-auto md:w-auto md:basis-auto md:pt-0">
              <Link
                href="/dashboard/affiliate/earnings"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5 border-violet-200/80 bg-white/90 text-violet-800 hover:bg-violet-50 dark:border-violet-800/60 dark:bg-zinc-900/90 dark:text-violet-200 dark:hover:bg-violet-950/50"
                )}
              >
                <Wallet className="size-4 shrink-0" aria-hidden />
                Earnings
              </Link>
              <MerchantAccountNavActions />
            </div>
          ) : null}
        </div>
      </nav>

      <VisualSearchModal open={visualOpen} onClose={() => setVisualOpen(false)} />

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
