/**
 * Pure parsers for the two AliExpress answers that can carry a DS order's tracking number (see
 * `lib/aliexpress-ds-tracking.ts`). Defensive on purpose: AliExpress wraps lists either as arrays or as
 * `{ <item_name>: [...] }` objects (TOP style) and the field names vary by API generation. Anything that does not look
 * like a real tracking number is ignored — "no tracking yet" is always a safe answer, a guessed number is not.
 */
export type AeTrackingInfo = {
  /** Carrier tracking number (normalised: trimmed, upper-case, no spaces). */
  number: string
  /** Carrier or logistics service name when AliExpress gives one. */
  carrier: string | null
  /** Which answer it came from. */
  source: "ds_order_tracking_get" | "trade_ds_order_get"
  /** Last event description when known (display / logs only). */
  lastEvent: string | null
}

type Rec = Record<string, unknown>

function asRecord(v: unknown): Rec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null
}

/** A list that may be an array, a `{ wrapper: [...] }` object, or a single object. */
function asList(v: unknown, wrapperKeys: string[]): Rec[] {
  if (Array.isArray(v)) return v.map(asRecord).filter((x): x is Rec => x !== null)
  const rec = asRecord(v)
  if (!rec) return []
  for (const key of wrapperKeys) {
    if (key in rec) return asList(rec[key], [])
  }
  return [rec]
}

function firstString(rec: Rec | null, keys: string[]): string | null {
  if (!rec) return null
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return null
}

/** Carrier tracking numbers: letters, digits and dashes, 8 to 40 characters, at least one digit. */
export function normaliseTrackingNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const compact = raw.replace(/\s+/g, "").toUpperCase()
  if (!/^[A-Z0-9-]{8,40}$/.test(compact)) return null
  if (!/\d/.test(compact)) return null
  return compact
}

/** The `<method>_response` node, then its `result` (or the root when AliExpress answered without the wrapper). */
function resultNode(payload: unknown, responseKey: string): Rec | null {
  const root = asRecord(payload)
  if (!root) return null
  const response = asRecord(root[responseKey]) ?? root
  return asRecord(response.result) ?? response
}

const NUMBER_KEYS = ["mail_no", "logistics_no", "tracking_number", "tracking_no", "waybill_no"]
const CARRIER_KEYS = ["carrier_name", "logistics_company", "logistics_service", "service_name", "carrier"]

/** `aliexpress.ds.order.tracking.get` */
export function parseAeTrackingGet(payload: unknown): AeTrackingInfo | null {
  const result = resultNode(payload, "aliexpress_ds_order_tracking_get_response")
  if (!result) return null
  if (result.ret === false || result.ret === "false") return null
  const data = asRecord(result.data) ?? result
  const lines = asList(data.tracking_detail_line_list, ["tracking_detail", "tracking_detail_line"])
  for (const line of lines) {
    const number = normaliseTrackingNumber(firstString(line, NUMBER_KEYS))
    if (!number) continue
    const nodes = asList(line.detail_node_list, ["detail_node"])
    const last = nodes[0] ?? null
    return {
      number,
      carrier: firstString(line, CARRIER_KEYS),
      source: "ds_order_tracking_get",
      lastEvent: firstString(last, ["tracking_detail_desc", "tracking_name", "desc"]),
    }
  }
  return null
}

/** `aliexpress.trade.ds.order.get` */
export function parseAeOrderGetTracking(payload: unknown): AeTrackingInfo | null {
  const result = resultNode(payload, "aliexpress_trade_ds_order_get_response")
  if (!result) return null
  const infos = asList(result.logistics_info_list, [
    "ae_order_logistics_info",
    "aeop_order_logistics_info",
    "order_logistics_info",
  ])
  for (const info of infos) {
    const number = normaliseTrackingNumber(firstString(info, NUMBER_KEYS))
    if (!number) continue
    return {
      number,
      carrier: firstString(info, CARRIER_KEYS),
      source: "trade_ds_order_get",
      lastEvent: null,
    }
  }
  return null
}
