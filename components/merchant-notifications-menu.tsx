"use client"

import Link from "next/link"
import { Bell } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { MerchantNotificationItem } from "@/components/merchant/merchant-notification-item"
import { buttonVariants } from "@/components/ui/button"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { SUPPLIER_INVITE_NOTIF } from "@/lib/supplier-invite-notif-constants"
import { SUPPLIER_AFFILIATE_INVITE_NOTIF } from "@/lib/supplier-affiliate-invite-notif-constants"
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
    showOrdersLink: (n) =>
      n.type === "NEW_ORDER" ||
      n.type === SUPPLIER_AFFILIATE_INVITE_NOTIF.REGISTERED ||
      n.type === SUPPLIER_AFFILIATE_INVITE_NOTIF.LISTING_LIVE,
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

function resolveNotificationLink(
  role: MerchantRole,
  n: NotificationRow,
  cfg: (typeof config)[MerchantRole]
): { href: string; label: string } | null {
  if (!cfg.showOrdersLink(n)) return null

  if (
    role === "AFFILIATE" &&
    (n.type === SUPPLIER_INVITE_NOTIF.CATALOG_LIVE ||
      n.type === SUPPLIER_INVITE_NOTIF.NEW_SUPPLIER_CATALOG)
  ) {
    return { href: AFFILIATE_CATALOG_PATH, label: "Parcourir le catalogue" }
  }

  if (role === "AFFILIATE" && n.type === SUPPLIER_INVITE_NOTIF.REGISTERED) {
    return { href: "/dashboard/affiliate/invite-supplier", label: "Voir l'invitation" }
  }

  if (
    role === "SUPPLIER" &&
    (n.type === SUPPLIER_AFFILIATE_INVITE_NOTIF.REGISTERED ||
      n.type === SUPPLIER_AFFILIATE_INVITE_NOTIF.LISTING_LIVE)
  ) {
    return { href: "/dashboard/supplier/invite-affiliate", label: "Voir les invitations affilié" }
  }

  return { href: cfg.ordersHref, label: cfg.ordersLinkLabel }
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
        className="w-[min(100vw-1.5rem,26rem)] overflow-hidden rounded-2xl border border-violet-200/60 bg-white/95 shadow-[0_24px_80px_-12px_rgba(91,33,182,0.35)] ring-1 ring-violet-500/10 backdrop-blur-xl dark:border-violet-900/50 dark:bg-zinc-950/95 dark:ring-violet-400/10"
      >
        <div className="relative border-b border-violet-100/80 bg-gradient-to-r from-violet-600/[0.08] via-emerald-500/[0.05] to-transparent px-4 py-3 dark:border-violet-900/40">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Notifications
              </p>
              {unreadCount > 0 ? (
                <p className="text-[11px] font-medium text-violet-700 dark:text-violet-400">
                  {unreadCount} unread
                </p>
              ) : (
                <p className="text-[11px] text-zinc-500">All caught up</p>
              )}
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="rounded-lg border border-violet-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/70"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
        </div>
        <ul className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain">
          {rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">{cfg.emptyLabel}</li>
          ) : (
            rows.map((n) => (
              <MerchantNotificationItem
                key={n.id}
                row={n}
                role={role}
                link={resolveNotificationLink(role, n, cfg)}
                onNavigate={() => setOpen(false)}
              />
            ))
          )}
        </ul>
        <div className="border-t border-violet-100/80 bg-zinc-50/80 p-2 dark:border-violet-900/40 dark:bg-zinc-900/50">
          <Link
            href={cfg.ordersHref}
            className="block rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 px-3 py-2 text-center text-xs font-bold text-white shadow-sm transition hover:from-violet-500 hover:to-violet-600 dark:from-violet-600 dark:to-violet-800"
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
          "relative gap-1.5 border-zinc-200 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/90",
          open && "border-violet-300 ring-2 ring-violet-400/20 dark:border-violet-700"
        )}
      >
        <Bell className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Alerts</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-emerald-500 px-1 text-[10px] font-bold text-white shadow-md">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {dropdownPanel ? createPortal(dropdownPanel, document.body) : null}
    </div>
  )
}
