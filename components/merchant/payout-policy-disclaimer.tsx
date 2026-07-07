import { getTranslations } from "next-intl/server"

import {
  AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
  PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
} from "@/lib/payout-policy-copy-shared"
import { cn } from "@/lib/utils"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  className?: string
}

export async function PayoutPolicyDisclaimer({ role, className }: Props) {
  const t = await getTranslations("payoutPolicy")

  return (
    <aside
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-4 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300",
        className
      )}
      data-testid="payout-policy-disclaimer"
    >
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{t("shared.stripePerOrder")}</p>
      <p className="mt-2">{t("shared.dashboardDisclaimer")}</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-4">
        {role === "SUPPLIER" ? (
          <>
            <li>{t("supplier.standard")}</li>
            <li>{t("supplier.lightning")}</li>
          </>
        ) : (
          <>
            <li>
              {t("affiliate.standard", { days: PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM })}
            </li>
            <li>
              {t("affiliate.autoConfirm", { days: AUTO_CONFIRM_DAYS_AFTER_DELIVERY })}
            </li>
          </>
        )}
        <li>{t("shared.returnsBlock")}</li>
        <li>{t("shared.clawback")}</li>
      </ul>
    </aside>
  )
}
