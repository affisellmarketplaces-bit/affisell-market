import Link from "next/link"
import { ArrowRight, CheckCircle2, Share2 } from "lucide-react"

import type { SupplierUrgentSnapshot } from "@/lib/supplier-mission-control"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { formatSlaCountdown, formatSlaHoursShort } from "@/lib/supplier-ship-sla"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  urgent: SupplierUrgentSnapshot
  storeSlug: string | null
}

type UrgentCard = {
  id: string
  title: string
  metric: string
  consequence: string
  href: string
  cta: string
  ctaArrow?: boolean
  tone: "amber" | "red" | "violet"
}

function buildCards(urgent: SupplierUrgentSnapshot): UrgentCard[] {
  const cards: UrgentCard[] = []
  if (urgent.ordersToShip > 0) {
    const slaMs = urgent.ordersToShipSlaMs
    const late = slaMs != null && slaMs <= 0
    const remainingMs = slaMs != null && slaMs > 0 ? slaMs : null
    const countLabel =
      urgent.ordersToShip === 1
        ? "1 commande à expédier"
        : `${urgent.ordersToShip} commandes à expédier`
    const title =
      remainingMs != null
        ? `${countLabel} < ${formatSlaHoursShort(remainingMs)}`
        : late
          ? `${countLabel} · SLA dépassé`
          : countLabel

    cards.push({
      id: "ship",
      title,
      metric: late
        ? "Payées · en retard d’expédition"
        : remainingMs != null
          ? `Payées · SLA dépassé dans ${formatSlaCountdown(remainingMs)}`
          : "Payées · en attente d’envoi",
      consequence:
        urgent.ordersToShipPenaltyCents > 0
          ? `Pénalité estimée : −${formatStoreCurrencyFromCents(urgent.ordersToShipPenaltyCents)} si retard`
          : "Les acheteurs attendent un suivi colis",
      href: "/dashboard/supplier/orders",
      cta: "Expédier maintenant",
      ctaArrow: true,
      tone: late ? "red" : "amber",
    })
  }
  if (urgent.returnsInProgress > 0) {
    cards.push({
      id: "returns",
      title:
        urgent.returnsInProgress === 1
          ? "1 retour en cours"
          : `${urgent.returnsInProgress} retours en cours`,
      metric: "Décision ou suivi requis",
      consequence: "SLA acheteur — risque litige",
      href: "/dashboard/supplier/returns",
      cta: "Traiter",
      tone: "violet",
    })
  }
  if (urgent.lowStockCount > 0) {
    cards.push({
      id: "stock",
      title:
        urgent.lowStockCount === 1
          ? "1 rupture stock"
          : `${urgent.lowStockCount} ruptures stock`,
      metric: "≤ 5 unités restantes",
      consequence: `Perte ${formatStoreCurrencyFromCents(urgent.lowStockDailyLossCents)}/jour estimée`,
      href: "/dashboard/supplier/products",
      cta: "Réassortir",
      tone: "red",
    })
  }
  return cards
}

const toneRing: Record<UrgentCard["tone"], string> = {
  amber: "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
  red: "border-red-200/80 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20",
  violet: "border-violet-200/80 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20",
}

export function SupplierUrgentActions({ urgent, storeSlug }: Props) {
  const cards = buildCards(urgent)
  const allClear =
    urgent.ordersToShip === 0 &&
    urgent.returnsInProgress === 0 &&
    urgent.lowStockCount === 0

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
                Aucune commande, retour ni rupture ne nécessite votre attention.
              </p>
            </div>
          </div>
          {urgent.ordersToShip === 0 ? (
            <EmptyOrdersHint storeSlug={storeSlug} />
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border p-4 shadow-sm",
                toneRing[card.tone]
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{card.title}</h3>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{card.metric}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.consequence}</p>
              </div>
              <Link
                href={card.href}
                className={cn(
                  buttonVariants({
                    variant: card.id === "ship" ? "default" : "outline",
                    size: "sm",
                  }),
                  card.id === "ship"
                    ? "w-fit gap-1 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600"
                    : "w-fit border-zinc-300/80 bg-white/80",
                  card.tone === "red" &&
                    card.id === "ship" &&
                    "bg-red-600 hover:bg-red-700 dark:bg-red-600"
                )}
              >
                {card.cta}
                {card.ctaArrow ? <ArrowRight className="h-3.5 w-3.5" aria-hidden /> : null}
              </Link>
            </article>
          ))}
        </div>
      )}

      {!allClear && urgent.ordersToShip === 0 ? (
        <EmptyOrdersHint storeSlug={storeSlug} />
      ) : null}
    </section>
  )
}

function EmptyOrdersHint({ storeSlug }: { storeSlug: string | null }) {
  const catalogHref = storeSlug ? `/store/supplier/${storeSlug}` : "/marketplace"
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Aucune commande en file. Boostez la visibilité :{" "}
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
