/** Parse persisted notification.message into structured UI fields (display-only). */

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
}

const EURO_IN_TEXT =
  /(?:€|EUR)\s*[\d\s.,]+|[\d\s.,]+\s*(?:€|EUR)/i

function firstMoneyToken(text: string): string | null {
  const m = text.match(EURO_IN_TEXT)
  return m ? m[0].replace(/\s+/g, " ").trim() : null
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
  const primaryAmount =
    firstMoneyToken(tail.match(/Net wholesale\s+([^(\s]+)/i)?.[0] ?? tail) ??
    firstMoneyToken(tail.match(/COGS\):\s*([^·]+)/i)?.[1] ?? tail) ??
    firstMoneyToken(tail)

  return {
    kind: "supplier_order",
    headline: "New order to ship",
    productName,
    qty,
    customerEmail,
    partnerCode,
    primaryLabel: "Net wholesale",
    primaryAmount: primaryAmount ?? undefined,
    detail: tail || undefined,
  }
}

export function parseAffiliateSaleNotification(message: string): ParsedMerchantNotification | null {
  const parts = splitMessageParts(message)
  if (parts[0] !== "Sale on your store" || parts.length < 2) return null

  const { productName, qty, nextIdx } = parseProductQtyFromParts(parts, 1)
  const tail = parts.slice(nextIdx).join(" · ")
  const earningsMatch = tail.match(/Your earnings\s+([^(\s]+)/i)
  const primaryAmount =
    firstMoneyToken(earningsMatch?.[0] ?? tail) ?? firstMoneyToken(tail)

  return {
    kind: "affiliate_sale",
    headline: "Sale on your store",
    productName,
    qty,
    primaryLabel: "Your earnings",
    primaryAmount: primaryAmount ?? undefined,
    detail: tail || undefined,
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
