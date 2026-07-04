"use client"

import { Percent, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { AffiliateVariantOption } from "@/lib/affiliate-storefront-variants"
import {
  marginEuroFromPrices,
  sellingPriceCentsFromMargin,
} from "@/lib/affiliate-variant-pricing"
import { cn } from "@/lib/utils"

type Props = {
  options: AffiliateVariantOption[]
  pick: Record<string, boolean>
  marginEuroByKey: Record<string, string>
  onPickChange: (key: string, checked: boolean) => void
  onMarginChange: (key: string, value: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
  onApplyGlobalMargin: (marginEuro: number) => void
  globalMarginEuro: number | null
  disabled?: boolean
}

function parseEuroInput(raw: string): number | null {
  const n = Number(String(raw).replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export function AffiliateVariantMarginEditor({
  options,
  pick,
  marginEuroByKey,
  onPickChange,
  onMarginChange,
  onSelectAll,
  onSelectNone,
  onApplyGlobalMargin,
  globalMarginEuro,
  disabled = false,
}: Props) {
  const t = useTranslations("affiliateDashboard.listingBuilder.variantMargins")
  const selectedCount = options.filter((o) => pick[o.key]).length

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 p-4 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-teal-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{t("title")}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
        {selectedCount > 0 && globalMarginEuro != null && Number.isFinite(globalMarginEuro) ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApplyGlobalMargin(globalMarginEuro)}
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-200"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("applyGlobalMargin", { amount: globalMarginEuro.toFixed(2) })}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="text-xs font-medium text-emerald-800 underline decoration-dotted"
          onClick={onSelectAll}
          disabled={disabled}
        >
          {t("selectAll")}
        </button>
        <button
          type="button"
          className="text-xs font-medium text-gray-600 underline decoration-dotted"
          onClick={onSelectNone}
          disabled={disabled}
        >
          {t("selectNone")}
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {options.map((opt) => {
          const checked = Boolean(pick[opt.key])
          const marginRaw = marginEuroByKey[opt.key] ?? ""
          const marginEuro = parseEuroInput(marginRaw)
          const sellingCents =
            marginEuro != null && marginEuro >= 0
              ? sellingPriceCentsFromMargin({
                  wholesaleCents: opt.wholesaleCents,
                  marginEuro,
                })
              : null
          const marginPct =
            marginEuro != null && opt.wholesaleCents > 0
              ? (marginEuro / (opt.wholesaleCents / 100)) * 100
              : null

          return (
            <li
              key={opt.key}
              className={cn(
                "rounded-xl border transition",
                checked
                  ? "border-emerald-300/80 bg-white shadow-sm dark:border-emerald-800/60 dark:bg-zinc-950/80"
                  : "border-gray-200/80 bg-gray-50/50 opacity-75 dark:border-zinc-800 dark:bg-zinc-900/40"
              )}
            >
              <label className="flex cursor-pointer items-start gap-3 px-3 py-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onPickChange(opt.key, !checked)}
                  className="mt-1 rounded border-gray-300"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {opt.label}
                    </span>
                    {opt.stock > 0 ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {t("stock", { count: opt.stock })}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
                    {t("supplier")}{" "}
                    <span className="font-medium tabular-nums text-gray-700 dark:text-zinc-300">
                      {formatStoreCurrencyFromCents(opt.wholesaleCents)}
                    </span>
                  </p>
                </div>
              </label>

              {checked ? (
                <div className="grid gap-3 border-t border-emerald-100/80 px-3 py-3 sm:grid-cols-[1fr_1fr_auto] dark:border-emerald-900/40">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {t("marginLabel")}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={disabled}
                      value={marginRaw}
                      onChange={(e) => onMarginChange(opt.key, e.target.value)}
                      placeholder="0.00"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {t("clientPrice")}
                    </label>
                    <p className="mt-2 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {sellingCents != null
                        ? formatStoreCurrencyFromCents(sellingCents)
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-end pb-1">
                    {marginPct != null ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        <Percent className="h-3 w-3" aria-hidden />
                        +{marginPct.toFixed(0)}%
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function initialVariantMarginEuroByKey(args: {
  options: AffiliateVariantOption[]
  variantPricing: Record<string, { sellingPriceCents: number; marginCents: number }> | null | undefined
  globalMarginEuro: number | null
}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const opt of args.options) {
    const saved = args.variantPricing?.[opt.key]
    if (saved?.marginCents != null && saved.marginCents >= 0) {
      out[opt.key] = (saved.marginCents / 100).toFixed(2)
    } else if (saved?.sellingPriceCents != null) {
      out[opt.key] = marginEuroFromPrices(opt.wholesaleCents, saved.sellingPriceCents).toFixed(2)
    } else if (args.globalMarginEuro != null && Number.isFinite(args.globalMarginEuro)) {
      out[opt.key] = args.globalMarginEuro.toFixed(2)
    } else {
      out[opt.key] = "0.00"
    }
  }
  return out
}
