"use client"

import { CheckCircle2, Circle, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import { assessListingQuality, type QualityCheckId } from "@/lib/listing-quality"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  description: string
  imageCount: number
  brand: string
  hasWarranty: boolean
  shipsFromCountry: string
  className?: string
}

/** Where to jump to fix each check (existing section anchors of the product form). */
const ANCHOR: Record<Exclude<QualityCheckId, "price">, string> = {
  title: "add-product-title-express",
  description: "add-product-story",
  photos: "add-product-media",
  brand: "add-product-classify",
  warranty: "add-product-variants",
  origin: "add-product-shipping-zone",
  delivery: "add-product-shipping-carriers",
}

function scrollTo(anchorId: string) {
  const el = document.getElementById(anchorId)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
  el.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])")?.focus({ preventScroll: true })
}

/**
 * The trust side of listing quality: what buyers (and the marketplace ranking) read as "a real shop" — a clean title,
 * a real description, several photos, a brand, a warranty, a declared origin and declared delivery.
 * Advisory: it never blocks publishing, it shows the score and the one-click way to each fix.
 */
export function SupplierTrustQualityBlock({ title, description, imageCount, brand, hasWarranty, shipsFromCountry, className }: Props) {
  const t = useTranslations("supplier.quality")
  const [deliveryDeclared, setDeliveryDeclared] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/supplier/shipping-profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { offers: [] }))
      .then((d: { offers?: unknown[] }) => alive && setDeliveryDeclared((d.offers?.length ?? 0) > 0))
      .catch(() => alive && setDeliveryDeclared(false))
    return () => {
      alive = false
    }
  }, [])

  const result = useMemo(
    () =>
      assessListingQuality({
        title,
        description,
        imageCount,
        brand,
        hasWarranty,
        shipsFromCountry,
        hasDeliveryProfile: deliveryDeclared === true,
      }),
    [title, description, imageCount, brand, hasWarranty, shipsFromCountry, deliveryDeclared]
  )
  if (title.trim().length === 0 && imageCount === 0) return null

  const tone =
    result.tier === "excellent"
      ? "text-emerald-700 dark:text-emerald-400"
      : result.tier === "good"
        ? "text-amber-700 dark:text-amber-400"
        : "text-red-700 dark:text-red-400"
  const tierKey = result.tier === "needs_work" ? "needsWork" : result.tier

  return (
    <div
      className={cn(
        "rounded-3xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/80",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="size-3.5" aria-hidden />
          {t("trustTitle")}
        </p>
        <p className={cn("rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold tabular-nums dark:bg-zinc-800", tone)}>
          {t(`tier.${tierKey}`)} · {result.score}
        </p>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{t("trustSub")}</p>
      <ul className="mt-3 space-y-1.5">
        {result.checks.flatMap((c) => {
          const id = c.id
          if (id === "price") return []
          return [(
            <li key={id}>
              <button
                type="button"
                onClick={() => scrollTo(ANCHOR[id])}
                className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left text-sm transition hover:bg-violet-50/80 dark:hover:bg-violet-950/30"
              >
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className={c.ok ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-700 dark:text-zinc-300"}>{t(`check.${id}`)}</span>
                  {!c.ok ? <span className="block text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{t(`hint.${id}`)}</span> : null}
                </span>
              </button>
            </li>
          )]
        })}
      </ul>
    </div>
  )
}
