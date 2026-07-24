"use client"

import Link from "next/link"
import { ArrowUpRight, Check, Mail, Package, Sparkles, Tag } from "lucide-react"
import { useLocale } from "next-intl"

import {
  formatNotificationRelativeTime,
  parseMerchantNotificationMessage,
  type MerchantNotificationBreakdown,
  type ParsedMerchantNotification,
} from "@/lib/merchant-notification-display"
import { cn } from "@/lib/utils"

type NotificationRow = {
  id: string
  type: string
  message: string
  imageUrl: string | null
  orderId: string | null
  read: boolean
  actionRequired?: boolean
  createdAt: string
}

type Props = {
  row: NotificationRow
  role: "SUPPLIER" | "AFFILIATE"
  link?: { href: string; label: string } | null
  onNavigate: () => void
  onMarkRead?: () => void
}

function LedgerRow({
  label,
  amount,
  tone = "neutral",
  hint,
}: {
  label: string
  amount: string
  tone?: "neutral" | "plus" | "fee" | "net"
  hint?: string
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        tone === "fee" &&
          "rounded-lg bg-violet-500/[0.07] px-2 py-1.5 ring-1 ring-inset ring-violet-500/20 dark:bg-violet-400/10 dark:ring-violet-400/25",
        tone === "net" && "pt-0.5"
      )}
    >
      <div className="min-w-0">
        <span
          className={cn(
            "text-[11px] font-medium",
            tone === "fee" && "font-semibold text-violet-800 dark:text-violet-200",
            tone === "net" && "text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800/80 dark:text-emerald-300/80",
            tone === "plus" && "text-zinc-600 dark:text-zinc-400",
            tone === "neutral" && "text-zinc-500 dark:text-zinc-400"
          )}
        >
          {label}
        </span>
        {hint ? (
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-400 dark:text-zinc-500">
            {hint}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums tracking-tight",
          tone === "net" && "text-lg font-black text-emerald-700 dark:text-emerald-400",
          tone === "fee" && "text-sm font-bold text-violet-700 dark:text-violet-300",
          tone === "plus" && "text-xs font-semibold text-zinc-700 dark:text-zinc-200",
          tone === "neutral" && "text-xs font-semibold text-zinc-600 dark:text-zinc-300"
        )}
      >
        {tone === "fee" && !/^[−\-–]/.test(amount) ? `−${amount}` : amount}
      </span>
    </div>
  )
}

function AffiliateEarningsLedger({
  breakdown,
  primaryLabel,
  primaryAmount,
}: {
  breakdown: MerchantNotificationBreakdown
  primaryLabel?: string
  primaryAmount?: string
}) {
  const net = breakdown.netEarnings ?? primaryAmount
  const hasStack =
    breakdown.commission ||
    breakdown.markup ||
    breakdown.affisellFee ||
    breakdown.clientTotal ||
    breakdown.lineHt ||
    breakdown.clientHt

  if (!net && !hasStack) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/90 via-white to-violet-50/50 shadow-[0_1px_0_rgba(16,185,129,0.12)] dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-violet-950/30">
      {net ? (
        <div className="border-b border-emerald-200/40 px-3 py-2.5 dark:border-emerald-900/40">
          <LedgerRow
            label={primaryLabel ?? "Your earnings"}
            amount={net}
            tone="net"
          />
        </div>
      ) : null}

      {hasStack ? (
        <div className="space-y-1.5 px-3 py-2.5">
          {breakdown.commission ? (
            <LedgerRow label="Commission" amount={breakdown.commission} tone="plus" />
          ) : null}
          {breakdown.markup ? (
            <LedgerRow label="Markup" amount={breakdown.markup} tone="plus" />
          ) : null}
          {breakdown.affisellFee ? (
            <LedgerRow
              label="Affisell fee"
              amount={breakdown.affisellFee}
              tone="fee"
              hint={
                breakdown.earningsBase
                  ? `Platform cut · base ${breakdown.earningsBase}`
                  : "Platform cut on your earnings"
              }
            />
          ) : null}

          {breakdown.clientTotal || breakdown.lineHt ? (
            <div className="mt-1 border-t border-zinc-200/70 pt-2 dark:border-zinc-800/80">
              {breakdown.clientTotal ? (
                <LedgerRow label="Client paid" amount={breakdown.clientTotal} tone="neutral" />
              ) : breakdown.lineHt ? (
                <LedgerRow label="Line HT" amount={breakdown.lineHt} tone="neutral" />
              ) : null}
              {breakdown.clientHt || breakdown.clientVat ? (
                <p className="mt-1 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                  {[
                    breakdown.clientHt ? `HT ${breakdown.clientHt}` : null,
                    breakdown.clientVat ? `VAT ${breakdown.clientVat}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SupplierWholesaleLedger({
  breakdown,
  primaryLabel,
  primaryAmount,
}: {
  breakdown?: MerchantNotificationBreakdown
  primaryLabel?: string
  primaryAmount?: string
}) {
  const net = breakdown?.netWholesale ?? primaryAmount
  if (!net) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/90 via-white to-transparent px-3 py-2.5 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-zinc-950">
      <LedgerRow label={primaryLabel ?? "Net wholesale"} amount={net} tone="net" />
      {breakdown?.affisellFee ? (
        <div className="mt-2">
          <LedgerRow
            label="Affisell fee"
            amount={breakdown.affisellFee}
            tone="fee"
            hint="Platform cut on this order"
          />
        </div>
      ) : null}
    </div>
  )
}

function MoneySurface({ parsed }: { parsed: ParsedMerchantNotification }) {
  if (parsed.kind === "affiliate_sale" && parsed.breakdown) {
    return (
      <AffiliateEarningsLedger
        breakdown={parsed.breakdown}
        primaryLabel={parsed.primaryLabel}
        primaryAmount={parsed.primaryAmount}
      />
    )
  }

  if (parsed.kind === "supplier_order") {
    return (
      <SupplierWholesaleLedger
        breakdown={parsed.breakdown}
        primaryLabel={parsed.primaryLabel}
        primaryAmount={parsed.primaryAmount}
      />
    )
  }

  if (parsed.primaryAmount) {
    return (
      <div className="flex items-baseline gap-2 rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50/90 to-transparent px-2.5 py-1.5 dark:border-emerald-900/40 dark:from-emerald-950/30">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/80">
          {parsed.primaryLabel ?? "Amount"}
        </span>
        <span className="text-base font-black tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
          {parsed.primaryAmount}
        </span>
      </div>
    )
  }

  return null
}

export function MerchantNotificationItem({ row, role, link, onNavigate, onMarkRead }: Props) {
  const locale = useLocale()
  const parsed = parseMerchantNotificationMessage(row.message)
  const isOrder = parsed.kind === "supplier_order"
  const isSale = parsed.kind === "affiliate_sale"
  const relative = formatNotificationRelativeTime(row.createdAt, locale)
  const showRawDetail =
    Boolean(parsed.detail && parsed.productName) &&
    !(isSale && parsed.breakdown) &&
    !(isOrder && parsed.breakdown?.netWholesale)

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
            {onMarkRead ? (
              <button
                type="button"
                aria-label="Mark as read"
                title="Mark as read"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onMarkRead()
                }}
                className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-200/80 bg-white/90 text-violet-700 opacity-100 transition hover:bg-violet-50 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/70"
              >
                <Check className="size-3.5" aria-hidden />
              </button>
            ) : null}
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

          <MoneySurface parsed={parsed} />

          {showRawDetail ? (
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
