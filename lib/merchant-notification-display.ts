/** Parse persisted notification.message into structured UI fields (display-only). */

export type MerchantNotificationBreakdown = {
  /** Client TTC when VAT is present. */
  clientTotal?: string
  clientHt?: string
  clientVat?: string
  /** Line HT when no VAT breakdown. */
  lineHt?: string
  /** Net pocket earnings (after Affisell platform fee). */
  netEarnings?: string
  commission?: string
  markup?: string
  /** Affisell platform fee deducted from affiliate earnings. */
  affisellFee?: string
  /** Gross earnings base used for the Affisell fee. */
  earningsBase?: string
  /** Supplier: net wholesale after partner + platform fee. */
  netWholesale?: string
}

export type ParsedMerchantNotification = {
  kind: "supplier_order" | "affiliate_sale" | "generic"
  headline: string
  productName?: string
  qty?: number
  customerEmail?: string
  partnerCode?: string
  primaryLabel?: string
  primaryAmount?: string
  detail?: string
  /** Structured money rows — prefer over truncated `detail` in UI. */
  breakdown?: MerchantNotificationBreakdown
}

/**
 * Money tokens must include at least one digit.
 * Do NOT put bare `\s` in the amount class without a leading digit — otherwise
 * `" €"` (space + euro) matches and the UI shows a naked `€`.
 */
const CURRENCY = String.raw`(?:€|EUR|\$|USD)`
const AMOUNT = String.raw`\d[\d.,\u00a0\u202f\u2009]*`
const MONEY_TOKEN = new RegExp(
  String.raw`${CURRENCY}\s*${AMOUNT}|${AMOUNT}\s*${CURRENCY}`,
  "i"
)
function normalizeMoneyToken(raw: string): string {
  return raw.replace(/[\s\u00a0\u202f\u2009]+/g, " ").trim()
}

export function firstMoneyToken(text: string): string | null {
  const m = text.match(MONEY_TOKEN)
  return m ? normalizeMoneyToken(m[0]) : null
}

function moneyAfterLabel(text: string, label: RegExp): string | null {
  const re = new RegExp(
    String.raw`${label.source}\s*(${MONEY_TOKEN.source})`,
    label.flags.includes("i") ? "i" : "i"
  )
  const m = text.match(re)
  return m?.[1] ? normalizeMoneyToken(m[1]) : null
}

function splitMessageParts(message: string): string[] {
  return message
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean)
}

function parseProductQtyFromParts(
  parts: string[],
  startIdx: number
): { productName: string; qty: number; nextIdx: number } {
  let accumulated = parts[startIdx] ?? ""
  let idx = startIdx + 1

  while (idx < parts.length) {
    const qtyMatch = accumulated.match(/ ×(\d+)$/)
    if (qtyMatch) {
      const qty = Math.max(1, Number.parseInt(qtyMatch[1]!, 10) || 1)
      const productName = accumulated.slice(0, qtyMatch.index).trim()
      return { productName, qty, nextIdx: idx }
    }
    accumulated = `${accumulated} · ${parts[idx]}`
    idx += 1
  }

  const trailingQty = accumulated.match(/ ×(\d+)$/)
  if (trailingQty) {
    const qty = Math.max(1, Number.parseInt(trailingQty[1]!, 10) || 1)
    const productName = accumulated.slice(0, trailingQty.index).trim()
    return { productName, qty, nextIdx: idx }
  }

  return { productName: accumulated.trim(), qty: 1, nextIdx: idx }
}

function parseClientBlock(block: string): Pick<
  MerchantNotificationBreakdown,
  "clientTotal" | "clientHt" | "clientVat" | "lineHt"
> {
  if (/^Line HT\b/i.test(block)) {
    return { lineHt: firstMoneyToken(block) ?? undefined }
  }
  if (!/^Client\b/i.test(block)) return {}
  return {
    clientTotal: firstMoneyToken(block) ?? undefined,
    clientHt: moneyAfterLabel(block, /HT\b/i) ?? undefined,
    clientVat: moneyAfterLabel(block, /VAT\b/i) ?? undefined,
  }
}

function parseEarningsParenthetical(paren: string): Pick<
  MerchantNotificationBreakdown,
  "commission" | "markup" | "affisellFee"
> {
  return {
    commission: moneyAfterLabel(paren, /commission\b/i) ?? undefined,
    markup: moneyAfterLabel(paren, /markup\b/i) ?? undefined,
    affisellFee:
      moneyAfterLabel(paren, /(?:−|-|–)?\s*fee\b/i) ??
      moneyAfterLabel(paren, /fee\b/i) ??
      undefined,
  }
}

export function parseSupplierOrderNotification(message: string): ParsedMerchantNotification | null {
  const parts = splitMessageParts(message)
  if (parts[0] !== "New order to ship" || parts.length < 2) return null

  const { productName, qty, nextIdx: idx } = parseProductQtyFromParts(parts, 1)
  let cursor = idx
  let customerEmail: string | undefined
  let partnerCode: string | undefined

  if (parts[cursor]?.includes("@")) {
    customerEmail = parts[cursor]
    cursor += 1
  }

  if (parts[cursor]?.startsWith("Partner listing ")) {
    partnerCode = parts[cursor]!.replace(/^Partner listing\s+/i, "").trim()
    cursor += 1
  }

  const tail = parts.slice(cursor).join(" · ")
  const netWholesale =
    moneyAfterLabel(tail, /Net wholesale\b/i) ??
    firstMoneyToken(tail.match(/COGS\):\s*([^·]+)/i)?.[1] ?? tail) ??
    firstMoneyToken(tail)

  const breakdown: MerchantNotificationBreakdown = {
    netWholesale: netWholesale ?? undefined,
    affisellFee: moneyAfterLabel(tail, /Affisell fee\b/i) ?? undefined,
  }

  return {
    kind: "supplier_order",
    headline: "New order to ship",
    productName,
    qty,
    customerEmail,
    partnerCode,
    primaryLabel: "Net wholesale",
    primaryAmount: netWholesale ?? undefined,
    detail: tail || undefined,
    breakdown: breakdown.netWholesale || breakdown.affisellFee ? breakdown : undefined,
  }
}

export function parseAffiliateSaleNotification(message: string): ParsedMerchantNotification | null {
  const parts = splitMessageParts(message)
  if (parts[0] !== "Sale on your store" || parts.length < 2) return null

  const { productName, qty, nextIdx } = parseProductQtyFromParts(parts, 1)
  const moneyParts = parts.slice(nextIdx)
  const tail = moneyParts.join(" · ")

  const breakdown: MerchantNotificationBreakdown = {}

  for (const part of moneyParts) {
    if (/^Client\b/i.test(part) || /^Line HT\b/i.test(part)) {
      Object.assign(breakdown, parseClientBlock(part))
      continue
    }

    const earningsBlock = part.match(
      /^Your earnings\s+(.+?)(?:\s*\(([^)]*)\))?$/i
    )
    if (earningsBlock) {
      breakdown.netEarnings =
        firstMoneyToken(earningsBlock[1] ?? "") ?? firstMoneyToken(part) ?? undefined
      if (earningsBlock[2]) {
        Object.assign(breakdown, parseEarningsParenthetical(earningsBlock[2]))
      }
      continue
    }

    if (/^Affisell fee\b/i.test(part)) {
      breakdown.affisellFee =
        moneyAfterLabel(part, /Affisell fee\b/i) ?? firstMoneyToken(part) ?? undefined
      const baseParen = part.match(/\(([^)]+)\)/)
      if (baseParen?.[1]) {
        breakdown.earningsBase = firstMoneyToken(baseParen[1]) ?? undefined
      }
    }
  }

  // Fallback for older / partially malformed messages
  if (!breakdown.netEarnings) {
    breakdown.netEarnings =
      moneyAfterLabel(tail, /Your earnings\b/i) ?? firstMoneyToken(tail) ?? undefined
  }
  if (!breakdown.affisellFee) {
    breakdown.affisellFee = moneyAfterLabel(tail, /Affisell fee\b/i) ?? undefined
  }

  const hasBreakdown = Object.values(breakdown).some(Boolean)

  return {
    kind: "affiliate_sale",
    headline: "Sale on your store",
    productName,
    qty,
    primaryLabel: "Your earnings",
    primaryAmount: breakdown.netEarnings,
    detail: tail || undefined,
    breakdown: hasBreakdown ? breakdown : undefined,
  }
}

export function parseMerchantNotificationMessage(message: string): ParsedMerchantNotification {
  const supplier = parseSupplierOrderNotification(message)
  if (supplier) return supplier

  const affiliate = parseAffiliateSaleNotification(message)
  if (affiliate) return affiliate

  const parts = splitMessageParts(message)
  return {
    kind: "generic",
    headline: parts[0] ?? message.slice(0, 80),
    detail: parts.length > 1 ? parts.slice(1).join(" · ") : message,
  }
}

export function formatNotificationRelativeTime(iso: string, locale = "fr-FR"): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return iso

  const diffSec = Math.round((Date.now() - then) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale.startsWith("fr") ? "fr" : "en", { numeric: "auto" })

  if (diffSec < 60) return rtf.format(-Math.max(1, diffSec), "second")
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return rtf.format(-diffMin, "minute")
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 48) return rtf.format(-diffHr, "hour")
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 14) return rtf.format(-diffDay, "day")

  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
