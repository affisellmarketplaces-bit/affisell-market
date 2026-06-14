import { getTranslations } from "next-intl/server"

import {
  WEEKLY_GOAL_BAR_SEGMENTS,
  type SupplierWeeklyGoalSnapshot,
} from "@/lib/supplier-weekly-goal-shared"
import { formatMoneyFromCents } from "@/lib/app-locale-format"
import type { AppLocale } from "@/lib/i18n-locale"
import {
  missionControlAffisellMuted,
  missionControlAffisellSubtext,
  missionControlHeading,
  missionControlKpiBar,
  missionControlKpiHighlight,
  missionControlPanel,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { cn } from "@/lib/utils"

type Props = {
  goal: SupplierWeeklyGoalSnapshot
  locale: AppLocale
}

export async function SupplierWeeklyGoalCard({ goal, locale }: Props) {
  const t = await getTranslations("supplierDashboard.weeklyGoal")

  const gmvLabel = formatMoneyFromCents(goal.weekGmvCents, locale, { maximumFractionDigits: 0 })
  const targetLabel = formatMoneyFromCents(goal.goalCents, locale, { maximumFractionDigits: 0 })
  const pctLabel = `${goal.progressPct}%`

  return (
    <section aria-labelledby="weekly-goal-heading" className={cn(missionControlPanel, "p-5 sm:p-6")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p
            id="weekly-goal-heading"
            className={cn("text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl", missionControlHeading)}
          >
            {gmvLabel}{" "}
            <span className={cn("text-lg font-medium sm:text-xl", missionControlAffisellMuted)}>
              {t("revenueLabel")}
            </span>
          </p>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {t("newStore")} <span aria-hidden>🎉</span>
            <span className={missionControlAffisellMuted}> · {t("weekTarget")} </span>
            <span className={missionControlAffisellSubtext}>{targetLabel}</span>
          </p>
        </div>
        <p className={cn("shrink-0 text-2xl", missionControlKpiHighlight)}>{pctLabel}</p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div
          className={cn("flex flex-1 gap-0.5 font-mono text-sm leading-none tracking-tighter", missionControlKpiBar)}
          role="progressbar"
          aria-valuenow={goal.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("progressAria", { pct: pctLabel })}
        >
          {Array.from({ length: WEEKLY_GOAL_BAR_SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "inline-block w-[1.15em] text-center",
                i < goal.filledSegments ? "opacity-100" : "opacity-25"
              )}
              aria-hidden
            >
              {i < goal.filledSegments ? "▓" : "░"}
            </span>
          ))}
        </div>
        <span className={cn("shrink-0 font-mono text-sm font-semibold tabular-nums", missionControlAffisellMuted)}>
          {pctLabel}
        </span>
      </div>
    </section>
  )
}
