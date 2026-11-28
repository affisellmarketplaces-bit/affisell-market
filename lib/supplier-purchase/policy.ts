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
 *     AUTO_ORDER_ENABLED absent or exactly "true";
 *   - SUPPLIER_PURCHASE_DAILY_LIMITS gives the channel a quota: `channel=N` (purchases started in the last 24 h, N a
 *     whole number 0–10000) or `channel=unlimited`, comma-separated. A channel cannot be opened without stating one, so
 *     a first activation is a canary by construction. The quota itself is enforced atomically with the claim
 *     (guard.server.ts): the allowed decision only carries it.
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
  | {
      allowed: true
      channel: SupplierPurchaseChannel
      /** Purchases allowed per rolling 24 h on this channel; null = explicitly unlimited. */
      dailyLimit: number | null
    }
  | { allowed: false; channel: SupplierPurchaseChannel; reason: SupplierPurchaseRefusal; detail: string }

export type SupplierPurchaseRefusal =
  | "master_switch_absent"
  | "master_switch_invalid"
  | "channels_absent"
  | "channels_invalid"
  | "channel_not_enabled"
  | "kill_switch_disable_auto_buy"
  | "kill_switch_auto_order_enabled"
  | "daily_limit_absent"
  | "daily_limit_invalid"
  /** Set by the guard, never by this pure function: the channel's quota for the last 24 h is used up. */
  | "daily_limit_reached"

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

export const SUPPLIER_PURCHASE_DAILY_LIMIT_MAX = 10_000

export function parseSupplierPurchaseDailyLimits(
  raw: string | undefined,
): { ok: true; limits: Map<SupplierPurchaseChannel, number | null> } | { ok: false; detail: string } {
  if (raw === undefined || raw === "") return { ok: false, detail: "absent" }
  const known = new Set<string>(SUPPLIER_PURCHASE_CHANNEL_IDS)
  const limits = new Map<SupplierPurchaseChannel, number | null>()
  for (const part of raw.split(",")) {
    const m = /^\s*([a-z_]+)\s*=\s*(unlimited|0|[1-9][0-9]{0,4})\s*$/.exec(part)
    if (!m || !known.has(m[1]!)) return { ok: false, detail: `invalid entry ${shown(part)}` }
    const channel = m[1] as SupplierPurchaseChannel
    if (limits.has(channel)) return { ok: false, detail: `duplicate channel ${shown(channel)}` }
    const n = m[2] === "unlimited" ? null : Number(m[2])
    if (n !== null && n > SUPPLIER_PURCHASE_DAILY_LIMIT_MAX)
      return { ok: false, detail: `limit too high ${shown(part)}` }
    limits.set(channel, n)
  }
  return { ok: true, limits }
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

  const limits = parseSupplierPurchaseDailyLimits(env.SUPPLIER_PURCHASE_DAILY_LIMITS)
  if (!limits.ok) {
    return limits.detail === "absent"
      ? refuse("daily_limit_absent", "SUPPLIER_PURCHASE_DAILY_LIMITS not set")
      : refuse("daily_limit_invalid", `SUPPLIER_PURCHASE_DAILY_LIMITS: ${limits.detail}`)
  }
  if (!limits.limits.has(channel))
    return refuse("daily_limit_absent", `${channel} has no entry in SUPPLIER_PURCHASE_DAILY_LIMITS`)
  return { allowed: true, channel, dailyLimit: limits.limits.get(channel)! }
}

/** True when at least one channel may buy — for the early gates that decide whether to even queue work. */
export function anySupplierPurchaseAllowed(env: Env): boolean {
  return SUPPLIER_PURCHASE_CHANNEL_IDS.some((c) => supplierPurchaseDecision(env, c).allowed)
}
