import { Suspense } from "react"
import { CreditCard } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PayoutMethodsGrid } from "@/components/affiliate/PayoutMethodsGrid"
import { PayoutMethodsPageClient } from "@/components/affiliate/payout-methods-page-client"
import PayoutMethodsSkeleton from "@/components/skeletons/PayoutMethodsSkeleton"
import { prisma } from "@/lib/prisma"

type Props = {
  affiliateId: string
}

async function AffiliateMultiPayoutList({ affiliateId }: Props) {
  const t = await getTranslations("affiliate.settings.payouts.multiPayout")

  const methods = await prisma.affiliatePayoutMethod.findMany({
    where: { affiliateId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      country: true,
      isDefault: true,
      status: true,
      last4: true,
    },
  })

  if (methods.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-200/70 bg-violet-50/30 py-12 text-center dark:border-violet-900/40 dark:bg-violet-950/20">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("emptyTitle")}</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("emptyBody")}</p>
      </div>
    )
  }

  return <PayoutMethodsGrid methods={methods} />
}

export async function AffiliateMultiPayoutSection({ affiliateId }: Props) {
  const t = await getTranslations("affiliate.settings.payouts.multiPayout")

  return (
    <section
      id="multi-payout"
      className="scroll-mt-24 space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950/60 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800 dark:text-emerald-200">
            <CreditCard className="size-3.5" aria-hidden />
            {t("badge")}
          </p>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t("description")}
          </p>
        </div>
        <PayoutMethodsPageClient />
      </div>
      <Suspense fallback={<PayoutMethodsSkeleton />}>
        <AffiliateMultiPayoutList affiliateId={affiliateId} />
      </Suspense>
    </section>
  )
}
