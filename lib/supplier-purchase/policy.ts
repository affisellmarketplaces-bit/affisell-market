/**
 * Supplier purchase policy — the ONE answer to "may this process buy from a supplier now?". Pure (reads only the env
 * object it is given), shared by every path that can spend money at a supplier: AliExpress DS API, AliExpress browser
 * checkout and its virtual card (`aliexpress`), CJ (`cj`), blind-dropship partner REST APIs (`partner_rest`), China
 * buying agents Superbuy / Anovabuy (`china_agent`), and the batch engine paying a supplier from its wallet or by
 * Stripe Connect transfer (`supplier_payment`).
 *
 * FAIL-CLOSED. A purchase is allowed only when ALL of these hold:
 *   - SUPPLIER_PURCHASES_ENABLED is exactly "true";
 *   - SUPPLIER_PURCHASE_CHANNELS lists the channel (comma-separated, from SUPPLIER_PURCHASE_CHANNEL_IDS only);
 *   - the legacy kill switches do not say otherwise: DISABLE_AUTO_BUY absent or exactly "false",
 *     AUTO_ORDER_ENABLED absent or exactly "true".
 * Anything absent, misspelt, differently cased, padded with spaces or unknown is a refusal — never a guess.
 */
export const SUPPLIER_PURCHASE_CHANNEL_IDS = [
  "aliexpress",
  "cj",
  "partner_rest",
  "china_agent",
  "supplier_payment",
] as const
export type SupplierPurchaseChannel = (typeof SUPPLIER_PURCHASE_CHANNEL_IDS)[number]

export type SupplierPurchaseDecision =
  | { allowed: true; channel: SupplierPurchaseChannel }
  | { allowed: false; channel: SupplierPurchaseChannel; reason: SupplierPurchaseRefusal; detail: string }

export type SupplierPurchaseRefusal =
  | "master_switch_absent"
  | "master_switch_invalid"
  | "channels_absent"
  | "channels_invalid"
  | "channel_not_enabled"
  | "kill_switch_disable_auto_buy"
  | "kill_switch_auto_order_enabled"

type Env = Record<string, string | undefined>

/** Shows a configured value in a log without letting it run long (they are flags, not secrets). */
const shown = (v: string) => JSON.stringify(v.length > 24 ? `${v.slice(0, 24)}…` : v)

export function parseSupplierPurchaseChannels(
  raw: string | undefined,
): { ok: true; channels: Set<SupplierPurchaseChannel> } | { ok: false; detail: string } {
  if (raw === undefined || raw === "") return { ok: false, detail: "absent" }
  const tokens = raw.split(",").map((t) => t.trim())
  const known = new Set<string>(SUPPLIER_PURCHASE_CHANNEL_IDS)
  const bad = tokens.filter((t) => !known.has(t))
  if (bad.length > 0) return { ok: false, detail: `unknown or empty channel ${bad.map(shown).join(", ")}` }
  return { ok: true, channels: new Set(tokens as SupplierPurchaseChannel[]) }
}

export function supplierPurchaseDecision(env: Env, channel: SupplierPurchaseChannel): SupplierPurchaseDecision {
  const refuse = (reason: SupplierPurchaseRefusal, detail: string): SupplierPurchaseDecision => ({
    allowed: false,
    channel,
    reason,
    detail,
  })

  const master = env.SUPPLIER_PURCHASES_ENABLED
  if (master === undefined || master === "") return refuse("master_switch_absent", "SUPPLIER_PURCHASES_ENABLED not set")
  if (master !== "true") return refuse("master_switch_invalid", `SUPPLIER_PURCHASES_ENABLED=${shown(master)}`)

  const disable = env.DISABLE_AUTO_BUY
  if (disable !== undefined && disable !== "" && disable !== "false") {
    return refuse("kill_switch_disable_auto_buy", `DISABLE_AUTO_BUY=${shown(disable)}`)
  }
  const autoOrder = env.AUTO_ORDER_ENABLED
  if (autoOrder !== undefined && autoOrder !== "" && autoOrder !== "true") {
    return refuse("kill_switch_auto_order_enabled", `AUTO_ORDER_ENABLED=${shown(autoOrder)}`)
  }

  const parsed = parseSupplierPurchaseChannels(env.SUPPLIER_PURCHASE_CHANNELS)
  if (!parsed.ok) {
    return parsed.detail === "absent"
      ? refuse("channels_absent", "SUPPLIER_PURCHASE_CHANNELS not set")
      : refuse("channels_invalid", `SUPPLIER_PURCHASE_CHANNELS: ${parsed.detail}`)
  }
  if (!parsed.channels.has(channel))
    return refuse("channel_not_enabled", `${channel} not in SUPPLIER_PURCHASE_CHANNELS`)
  return { allowed: true, channel }
}

/** True when at least one channel may buy — for the early gates that decide whether to even queue work. */
export function anySupplierPurchaseAllowed(env: Env): boolean {
  return SUPPLIER_PURCHASE_CHANNEL_IDS.some((c) => supplierPurchaseDecision(env, c).allowed)
}
