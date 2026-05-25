"use client"

import Link from "next/link"
import { Bell, Package, Sparkles } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { buttonVariants } from "@/components/ui/button"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { SUPPLIER_INVITE_NOTIF } from "@/lib/supplier-invite-notif-constants"
import { cn } from "@/lib/utils"

type NotificationRow = {
  id: string
  type: string
  message: string
  imageUrl: string | null
  orderId: string | null
  read: boolean
  createdAt: string
}

type MerchantRole = "SUPPLIER" | "AFFILIATE"

const config: Record<
  MerchantRole,
  {
    apiPath: string
    eventName: string
    ordersHref: string
    ordersLinkLabel: string
    emptyLabel: string
    showOrdersLink: (n: NotificationRow) => boolean
  }
> = {
  SUPPLIER: {
    apiPath: "/api/supplier/notifications",
    eventName: "affisell:supplier-notifications-changed",
    ordersHref: "/dashboard/supplier/orders",
    ordersLinkLabel: "Open orders to ship",
    emptyLabel: "No notifications yet.",
    showOrdersLink: (n) => n.type === "NEW_ORDER" && Boolean(n.orderId),
  },
  AFFILIATE: {
    apiPath: "/api/affiliate/notifications",
    eventName: "affisell:affiliate-notifications-changed",
    ordersHref: "/dashboard/affiliate/earnings",
    ordersLinkLabel: "View earnings",
    emptyLabel: "No sales alerts yet.",
    showOrdersLink: (n) =>
      n.type === "NEW_SALE" ||
      n.type === SUPPLIER_INVITE_NOTIF.CATALOG_LIVE ||
      n.type === SUPPLIER_INVITE_NOTIF.NEW_SUPPLIER_CATALOG,
  },
}

function subscribeMerchantNotifications(eventName: string, listener: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(eventName, listener)
  return () => window.removeEventListener(eventName, listener)
}

export function MerchantNotificationsMenu({
  role,
  className,
}: {
  role: MerchantRole
  className?: string
}) {
  const cfg = config[role]
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [rows, setRows] = useState<NotificationRow[]>([])
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; right: number } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(cfg.apiPath, { cache: "no-store" })
    if (!res.ok) return
    const j = (await res.json()) as { unreadCount: number; notifications: NotificationRow[] }
    setUnreadCount(j.unreadCount)
    setRows(j.notifications)
  }, [cfg.apiPath])

  useEffect(() => {
    void load()
    const unsub = subscribeMerchantNotifications(cfg.eventName, () => void load())
    const interval = window.setInterval(() => void load(), 60_000)
    return () => {
      unsub()
      window.clearInterval(interval)
    }
  }, [load, cfg.eventName])

  useLayoutEffect(() => {
    if (!open) {
      setDropdownCoords(null)
      return
    }
    function updatePosition() {
      const el = buttonRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setDropdownCoords({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }
    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocClick(ev: MouseEvent) {
      const target = ev.target as Node
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  async function markAllRead() {
    await fetch(cfg.apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
    await load()
    window.dispatchEvent(new CustomEvent(cfg.eventName))
  }

  const dropdownPanel =
    open && dropdownCoords && typeof document !== "undefined" ? (
      <div
        ref={dropdownRef}
        role="dialog"
        aria-label="Notifications"
        style={{
          position: "fixed",
          top: dropdownCoords.top,
          right: dropdownCoords.right,
          zIndex: 200,
        }}
        className="w-[min(100vw-2rem,24rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-950 dark:ring-white/10"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Notifications</p>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-400"
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {rows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-zinc-500">{cfg.emptyLabel}</li>
          ) : (
            rows.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "border-b border-zinc-50 px-3 py-2.5 last:border-0 dark:border-zinc-900",
                  !n.read && "bg-violet-50/60 dark:bg-violet-950/30"
                )}
              >
                <div className="flex gap-2.5">
                  {n.imageUrl ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={n.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                      {role === "AFFILIATE" ? (
                        <Sparkles className="size-5" aria-hidden />
                      ) : (
                        <Package className="size-5" aria-hidden />
                      )}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{new Date(n.createdAt).toLocaleString()}</p>
                    {cfg.showOrdersLink(n) ? (
                      <Link
                        href={
                          role === "AFFILIATE" &&
                          (n.type === SUPPLIER_INVITE_NOTIF.CATALOG_LIVE ||
                            n.type === SUPPLIER_INVITE_NOTIF.NEW_SUPPLIER_CATALOG)
                            ? AFFILIATE_CATALOG_PATH
                            : role === "AFFILIATE" && n.type === SUPPLIER_INVITE_NOTIF.REGISTERED
                              ? "/dashboard/affiliate/invite-supplier"
                              : cfg.ordersHref
                        }
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline dark:text-violet-400"
                        onClick={() => setOpen(false)}
                      >
                        {role === "SUPPLIER" ? (
                          <Package className="size-3" aria-hidden />
                        ) : (
                          <Sparkles className="size-3" aria-hidden />
                        )}
                        {role === "AFFILIATE" && n.type === SUPPLIER_INVITE_NOTIF.REGISTERED
                          ? "Voir l'invitation"
                          : role === "AFFILIATE" &&
                              (n.type === SUPPLIER_INVITE_NOTIF.CATALOG_LIVE ||
                                n.type === SUPPLIER_INVITE_NOTIF.NEW_SUPPLIER_CATALOG)
                            ? "Parcourir le catalogue"
                            : cfg.ordersLinkLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-zinc-100 p-2 dark:border-zinc-800">
          <Link
            href={cfg.ordersHref}
            className="block rounded-lg px-2 py-1.5 text-center text-xs font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
            onClick={() => setOpen(false)}
          >
            {role === "SUPPLIER" ? "All orders to ship →" : "Earnings & payouts →"}
          </Link>
        </div>
      </div>
    ) : null

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "relative gap-1.5 border-zinc-200 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/90"
        )}
      >
        <Bell className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Alerts</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {dropdownPanel ? createPortal(dropdownPanel, document.body) : null}
    </div>
  )
}
