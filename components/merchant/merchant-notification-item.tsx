"use client"

import Link from "next/link"
import { ArrowUpRight, Mail, Package, Sparkles, Tag } from "lucide-react"
import { useLocale } from "next-intl"

import {
  formatNotificationRelativeTime,
  parseMerchantNotificationMessage,
} from "@/lib/merchant-notification-display"
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

type Props = {
  row: NotificationRow
  role: "SUPPLIER" | "AFFILIATE"
  link?: { href: string; label: string } | null
  onNavigate: () => void
}

export function MerchantNotificationItem({ row, role, link, onNavigate }: Props) {
  const locale = useLocale()
  const parsed = parseMerchantNotificationMessage(row.message)
  const isOrder = parsed.kind === "supplier_order"
  const isSale = parsed.kind === "affiliate_sale"
  const relative = formatNotificationRelativeTime(row.createdAt, locale)

  return (
    <li
      className={cn(
        "group relative border-b border-zinc-100/80 px-3 py-3 last:border-0 dark:border-zinc-800/80",
        !row.read &&
          "bg-gradient-to-r from-violet-50/90 via-emerald-50/40 to-transparent dark:from-violet-950/40 dark:via-emerald-950/20"
      )}
    >
      {!row.read ? (
        <span
          className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-gradient-to-b from-violet-500 to-emerald-400"
          aria-hidden
        />
      ) : null}

      <div className="flex gap-3">
        <div className="relative shrink-0">
          {row.imageUrl ? (
            <div
              className={cn(
                "relative h-14 w-14 overflow-hidden rounded-2xl border bg-zinc-100 shadow-sm dark:bg-zinc-800",
                !row.read
                  ? "border-violet-300/70 ring-2 ring-violet-400/25 dark:border-violet-700/60"
                  : "border-zinc-200 dark:border-zinc-700"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm",
                isOrder
                  ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 dark:border-emerald-900/50 dark:from-emerald-950/50 dark:to-teal-950/30 dark:text-emerald-300"
                  : "border-violet-200/80 bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-700 dark:border-violet-900/50 dark:from-violet-950/50 dark:to-indigo-950/30 dark:text-violet-300"
              )}
            >
              {role === "AFFILIATE" ? (
                <Sparkles className="size-6" aria-hidden />
              ) : (
                <Package className="size-6" aria-hidden />
              )}
            </span>
          )}
          {!row.read ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                isOrder
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : isSale
                    ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              )}
            >
              {parsed.headline}
            </span>
            {parsed.qty != null ? (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white dark:bg-zinc-100 dark:text-zinc-900">
                ×{parsed.qty}
              </span>
            ) : null}
            <span className="ml-auto text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              {relative}
            </span>
          </div>

          {parsed.productName ? (
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
              {parsed.productName}
            </p>
          ) : (
            <p className="line-clamp-3 text-sm leading-snug text-zinc-700 dark:text-zinc-300">
              {parsed.detail ?? row.message}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {parsed.customerEmail ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-zinc-200/80 bg-white/70 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                <Mail className="size-3 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{parsed.customerEmail}</span>
              </span>
            ) : null}
            {parsed.partnerCode ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200/70 bg-violet-50/80 px-2 py-1 text-[10px] font-semibold text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200">
                <Tag className="size-3 shrink-0 opacity-70" aria-hidden />
                {parsed.partnerCode}
              </span>
            ) : null}
          </div>

          {parsed.primaryAmount ? (
            <div className="flex items-baseline gap-2 rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50/90 to-transparent px-2.5 py-1.5 dark:border-emerald-900/40 dark:from-emerald-950/30">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/80">
                {parsed.primaryLabel ?? "Amount"}
              </span>
              <span className="text-base font-black tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                {parsed.primaryAmount}
              </span>
            </div>
          ) : null}

          {parsed.detail && parsed.productName ? (
            <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {parsed.detail}
            </p>
          ) : null}

          {link ? (
            <Link
              href={link.href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 transition group-hover:gap-1.5 dark:text-violet-400"
              onClick={onNavigate}
            >
              {link.label}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  )
}
