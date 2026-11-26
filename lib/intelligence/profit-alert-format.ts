import type { ProfitAlertPayload } from "@/lib/intelligence/profit-alert-types"

/**
 * Turns an alert payload into the reader's language — pure. `t` is a next-intl translator on the
 * `affiliate.profitAlerts` namespace (server: createTranslator + loadAppMessages; page: getTranslations). The same
 * function feeds the in-app notification, the e-mail and the alerts list, so the three never say different things.
 */
type T = (key: string, values?: Record<string, string | number>) => string

export function formatAlertMoney(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, { style: "currency", currency: "EUR" }).format(cents / 100)
}

export function formatAlertDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, { day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(
    new Date(iso)
  )
}

export function profitAlertTexts(p: ProfitAlertPayload, t: T, locale: string) {
  const money = (c: number) => formatAlertMoney(c, locale)
  const title = t("title", { product: p.name })
  const change = t("change", {
    from: money(p.previousNetCents),
    to: money(p.currentNetCents),
    drop: money(-p.netChangeCents),
    previousOrders: p.previousOrders,
    currentOrders: p.currentOrders,
  })
  const since =
    p.sinceKind === "period_start"
      ? t("sincePeriod")
      : t(`since.${p.sinceKind}`, { date: formatAlertDate(p.sinceIso, locale) })
  const causes = p.causes.map((c) => {
    const amount = p.effects[CAUSE_DRIVER[c] ?? ""]
    return amount != null && amount < 0 ? t("causeWithAmount", { cause: t(`causes.${c}`), amount: money(-amount) }) : t(`causes.${c}`)
  })
  let suggestion: string
  switch (p.suggestion.kind) {
    case "restore_markup":
    case "previous_price":
      suggestion = t(`suggestion.${p.suggestion.kind}`, {
        price: money(p.suggestion.priceCents),
        net: money(p.suggestion.netPerSaleCents),
        sales: p.suggestion.salesToMatch30 ?? "—",
      })
      break
    default:
      suggestion = t(`suggestion.none.${p.primaryCause}`)
  }
  /** One line for the notification bell. */
  const short = t("short", { product: p.name, drop: money(-p.netChangeCents), cause: t(`causes.${p.primaryCause}`) })
  return { title, change, since, causes, suggestion, short, disclaimer: t("disclaimer") }
}

/** Which attribution driver measures each cause (for the amount shown next to it). */
const CAUSE_DRIVER: Record<string, string> = {
  volume_down: "volume",
  your_price_down: "selling_price",
  collected_price_down: "selling_price",
  supplier_price_up: "supplier_price",
  commission_down: "commission",
  fees_up: "fees",
  refunds_up: "refunds",
}
