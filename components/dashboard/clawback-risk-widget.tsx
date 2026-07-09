import Link from "next/link"
import { AlertTriangle, CircleHelp } from "lucide-react"

import { BentoCard } from "@/components/affisell/bento-ui"
import {
  CLAWBACK_RISK_WARNING_CENTS,
  CLAWBACK_RISK_WINDOW_DAYS,
} from "@/lib/affiliate-clawback-risk"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  riskCents: number
}

const TOOLTIP =
  "Conformément aux CGA art.5. En cas de retour client accepté, la commission est annulée même si déjà versée."

export function ClawbackRiskWidget({ riskCents }: Props) {
  const isEmpty = riskCents <= 0
  const showWarning = riskCents > CLAWBACK_RISK_WARNING_CENTS
  const amountLabel = formatStoreCurrencyFromCents(riskCents, "EUR")

  return (
    <BentoCard
      className={cn(
        "relative overflow-hidden border-zinc-200/80 dark:border-zinc-800",
        showWarning &&
          "border-amber-300/80 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 dark:border-amber-900/50 dark:from-amber-950/30 dark:via-zinc-950 dark:to-orange-950/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Risque clawback {CLAWBACK_RISK_WINDOW_DAYS}j
            </p>
            {showWarning ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                <AlertTriangle className="size-3" aria-hidden />
                Élevé
              </span>
            ) : null}
          </div>

          {isEmpty ? (
            <p className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-200">
              Aucun risque détecté 🎉
            </p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-white">
                {amountLabel}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Montant débité de votre prochain payout si tous les remboursements sont confirmés
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title={TOOLTIP}
          aria-label={TOOLTIP}
        >
          <CircleHelp className="size-5" aria-hidden />
        </button>
      </div>

      <Link
        href="/dashboard/refunds"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
      >
        Voir détails
      </Link>
    </BentoCard>
  )
}
