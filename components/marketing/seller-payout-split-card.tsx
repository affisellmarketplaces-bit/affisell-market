import { getTranslations } from "next-intl/server"

const SPLIT = [
  { key: "supplier" as const, amount: "60 €", pct: 60, color: "bg-sky-500" },
  { key: "platform" as const, amount: "10 €", pct: 10, color: "bg-violet-500" },
  { key: "seller" as const, amount: "25 €", pct: 25, color: "bg-emerald-500" },
  { key: "affiliate" as const, amount: "5 €", pct: 5, color: "bg-amber-500" },
]

export async function SellerPayoutSplitCard() {
  const t = await getTranslations("sellers.payout")

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t("title")}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      <p className="mt-4 text-sm font-semibold text-zinc-500">
        {t("saleLabel")} · <span className="text-2xl font-bold text-zinc-900 dark:text-white">100 €</span>
      </p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {SPLIT.map((row) => (
          <div key={row.key} className={row.color} style={{ width: `${row.pct}%` }} title={t(row.key)} />
        ))}
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {SPLIT.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3 dark:border-zinc-800"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span className={`h-2.5 w-2.5 rounded-full ${row.color}`} aria-hidden />
              {t(row.key)}
            </span>
            <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{row.amount}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
