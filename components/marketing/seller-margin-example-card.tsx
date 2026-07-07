import { getTranslations } from "next-intl/server"

/** Static margin demo — seller landing & how-it-works. */
export async function SellerMarginExampleCard() {
  const t = await getTranslations("sellers.marginExample")

  const rows = [
    { label: t("supplierLabel"), value: t("supplierValue"), tone: "text-zinc-600 dark:text-zinc-400" },
    { label: t("suggestedLabel"), value: t("suggestedValue"), tone: "text-zinc-900 dark:text-zinc-100" },
    {
      label: t("marginLabel"),
      value: t("marginValue"),
      tone: "text-emerald-600 dark:text-emerald-400 font-bold",
    },
    { label: t("commissionLabel"), value: t("commissionValue"), tone: "text-violet-600 dark:text-violet-400" },
  ]

  return (
    <section className="rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 shadow-sm dark:border-violet-500/20 dark:from-violet-950/40 dark:via-zinc-950 dark:to-sky-950/20 sm:p-8">
      <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{t("title")}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{row.label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums ${row.tone}`}>{row.value}</dd>
          </div>
        ))}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/30 sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
            {t("potentialLabel")}
          </dt>
          <dd className="mt-1 text-2xl tracking-widest text-amber-600 dark:text-amber-300">
            {t("potentialStars")}
          </dd>
        </div>
      </dl>
    </section>
  )
}
