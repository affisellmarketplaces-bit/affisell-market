import Link from "next/link"
import { CheckCircle2, Share2 } from "lucide-react"

import type { SupplierUrgentSnapshot } from "@/lib/supplier-urgent-snapshot"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { formatSlaCountdown, formatSlaHoursShort } from "@/lib/supplier-ship-sla"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  urgent: SupplierUrgentSnapshot
  storeSlug: string | null
}

type SlotProps = {
  active: boolean
  title: string
  titleSubline?: string
  metric: string
  consequence: string
  href: string
  cta: string
  tone: "amber" | "red" | "violet" | "zinc"
  ctaVariant?: "default" | "outline"
}

const toneRing: Record<SlotProps["tone"], string> = {
  amber: "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
  red: "border-red-200/80 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20",
  violet: "border-violet-200/80 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20",
  zinc: "border-zinc-200/80 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30",
}

function UrgentSlot({
  active,
  title,
  titleSubline,
  metric,
  consequence,
  href,
  cta,
  tone,
  ctaVariant = "outline",
}: SlotProps) {
  return (
    <article
      className={cn(
        "flex min-h-[9.5rem] flex-col gap-3 rounded-2xl border p-4 shadow-sm",
        active ? toneRing[tone] : toneRing.zinc
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h3
          className={cn(
            "text-sm font-semibold leading-snug",
            active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500"
          )}
        >
          {title}
          {active && titleSubline ? (
            <span className="mt-0.5 block text-xs font-bold text-amber-700 dark:text-amber-300">
              {titleSubline}
            </span>
          ) : null}
        </h3>
        <p
          className={cn(
            "text-xs font-medium",
            active ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"
          )}
        >
          {metric}
        </p>
        <p
          className={cn(
            "text-xs",
            active ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400/80 dark:text-zinc-600"
          )}
        >
          {consequence}
        </p>
      </div>
      {active ? (
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant: ctaVariant, size: "sm" }),
            ctaVariant === "default" &&
              tone === "amber" &&
              "w-fit bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600",
            ctaVariant === "default" &&
              tone === "red" &&
              "w-fit bg-red-600 text-white hover:bg-red-700 dark:bg-red-600",
            ctaVariant === "default" &&
              tone === "violet" &&
              "w-fit bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600",
            ctaVariant === "outline" && "w-fit border-zinc-300/80 bg-white/80 dark:bg-zinc-950/80"
          )}
        >
          {cta}
        </Link>
      ) : (
        <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
      )}
    </article>
  )
}

function buildShipSlot(urgent: SupplierUrgentSnapshot): SlotProps {
  const active = urgent.ordersToShip > 0
  const slaMs = urgent.ordersToShipSlaMs
  const late = slaMs != null && slaMs <= 0
  const remainingMs = slaMs != null && slaMs > 0 ? slaMs : null

  const countTitle =
    urgent.ordersToShip === 1
      ? "1 commande à expédier"
      : `${urgent.ordersToShip} commandes à expédier`

  return {
    active,
    title: countTitle,
    titleSubline:
      active && remainingMs != null
        ? `< ${formatSlaHoursShort(remainingMs)}`
        : active && late
          ? "SLA dépassé"
          : undefined,
    metric: !active
      ? "Aucune en attente"
      : late
        ? "Payées · en retard"
        : remainingMs != null
          ? `Payées · SLA dépassé dans ${formatSlaCountdown(remainingMs)}`
          : "Payées · en attente",
    consequence:
      active && urgent.ordersToShipPenaltyCents > 0
        ? `Pénalité estimée : −${formatStoreCurrencyFromCents(urgent.ordersToShipPenaltyCents)} si retard`
        : active
          ? "Risque note acheteur si retard"
          : "—",
    href: "/dashboard/supplier/orders",
    cta: "Expédier",
    tone: late ? "red" : "amber",
    ctaVariant: active ? "default" : "outline",
  }
}

function buildStockSlot(urgent: SupplierUrgentSnapshot): SlotProps {
  const active = urgent.lowStockCount > 0
  const first = urgent.lowStockLines[0]
  const extra = urgent.lowStockCount > 1 ? urgent.lowStockCount - 1 : 0

  const title = active
    ? urgent.lowStockCount === 1
      ? "1 Rupture"
      : `${urgent.lowStockCount} Ruptures`
    : "Ruptures stock"

  const skuLabel = first
    ? extra > 0
      ? `SKU ${first.label} · +${extra}`
      : `SKU ${first.label}`
    : "—"

  const stockLine =
    first != null
      ? first.stock <= 0
        ? "0 stock"
        : `${first.stock} restant${first.stock > 1 ? "s" : ""}`
      : "—"

  const restockHref = first
    ? `/dashboard/supplier/products/${first.productId}${first.variantId ? "#add-product-variants" : ""}`
    : "/dashboard/supplier/products"

  return {
    active,
    title,
    metric: active ? skuLabel : "Stocks OK",
    consequence: active ? stockLine : "—",
    href: restockHref,
    cta: "Réassortir",
    tone: first != null && first.stock <= 0 ? "red" : "amber",
    ctaVariant: active ? "default" : "outline",
  }
}

function buildMessageSlot(urgent: SupplierUrgentSnapshot): SlotProps {
  const active = urgent.clientMessagesCount > 0
  const n = urgent.clientMessagesCount

  return {
    active,
    title: active
      ? n === 1
        ? "1 Message client"
        : `${n} Messages client`
      : "Message client",
    metric: active ? "sans réponse" : "Boîte à jour",
    consequence: active
      ? urgent.shopRatingImpactPct > 0
        ? `−${urgent.shopRatingImpactPct} % note shop`
        : "Réponse attendue"
      : "—",
    href: "/dashboard/supplier/returns",
    cta: "Répondre",
    tone: "violet",
    ctaVariant: active ? "default" : "outline",
  }
}

export function SupplierUrgentActions({ urgent, storeSlug }: Props) {
  const ship = buildShipSlot(urgent)
  const stock = buildStockSlot(urgent)
  const message = buildMessageSlot(urgent)

  const allClear = !ship.active && !stock.active && !message.active

  return (
    <section aria-labelledby="urgent-heading" className="space-y-4">
      <h2 id="urgent-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Actions urgentes
      </h2>

      {allClear ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 px-5 py-6 dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <p className="font-semibold text-emerald-950 dark:text-emerald-100">Tout est à jour ✅</p>
              <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                Expéditions, stocks et messages clients sont à jour.
              </p>
            </div>
          </div>
          <EmptyOrdersHint storeSlug={storeSlug} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <UrgentSlot {...ship} />
          <UrgentSlot {...stock} />
          <UrgentSlot {...message} />
        </div>
      )}
    </section>
  )
}

function EmptyOrdersHint({ storeSlug }: { storeSlug: string | null }) {
  const catalogHref = storeSlug ? `/store/supplier/${storeSlug}` : "/marketplace"
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Boostez la visibilité :{" "}
      <Link
        href={catalogHref}
        className="inline-flex items-center gap-1 font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden />
        Partager catalogue
      </Link>
    </p>
  )
}
