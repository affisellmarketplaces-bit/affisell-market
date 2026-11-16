import "server-only"

import { isAeDryRun } from "@/lib/fulfillment/ae-dry-run"
import { getValidAccessToken } from "@/lib/aliexpress-oauth"
import { AliExpressApiError, AliExpressClient } from "@/lib/aliexpress-open-api"
import { ALIEXPRESS_DS_SYNC_HOSTS, callAliExpressSyncMethod } from "@/lib/aliexpress-ds-sync"
import { readAliExpressConfig } from "@/lib/aliexpress-config"
import {
  parseAeOrderGetTracking,
  parseAeTrackingGet,
  type AeTrackingInfo,
} from "@/lib/aliexpress-ds-tracking-parse"

/**
 * Tracking of an AliExpress DS order already placed (finalisation master doc, G4). It replaces
 * `fetchAeTrackingPlaceholder`, which always answered "no tracking": a bought order stayed CONFIRMED forever, the buyer
 * never got a tracking number and the supplier payout gated on shipment never released.
 *
 * Two READ-ONLY methods, in order, on each host of `ALIEXPRESS_DS_SYNC_HOSTS`:
 *   1. `aliexpress.ds.order.tracking.get` (`ae_order_id`, `language`) — the dropshipper tracking method;
 *   2. `aliexpress.trade.ds.order.get` (`single_order_query`) — already used by the cancellation flow; its result carries
 *      the logistics number once the seller has shipped.
 * Nothing here writes to AliExpress. Field names are parsed defensively (`lib/aliexpress-ds-tracking-parse.ts`): they come
 * from AliExpress's public documentation and were NOT checked against a live answer (no access from the development
 * environment) — a shape that is not recognised yields "no tracking yet", never a guessed number.
 */
const TRACKING_METHOD = "aliexpress.ds.order.tracking.get"
const ORDER_GET_METHOD = "aliexpress.trade.ds.order.get"

export type FetchAeTrackingResult =
  | { ok: true; tracking: AeTrackingInfo | null; host: string }
  | { ok: false; error: string }

function isMethodUnavailable(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("api path is invalid") ||
    m.includes("isv.api-not-exist") ||
    m.includes("api not exist") ||
    m.includes("invalid-method") ||
    m.includes("invalid method") ||
    m.includes("method not support") ||
    m.includes("permission deny") ||
    m.includes("insufficient isv permissions") ||
    m.includes("not authorized")
  )
}

export async function fetchAliExpressOrderTracking(aeOrderIdRaw: string): Promise<FetchAeTrackingResult> {
  const aeOrderId = aeOrderIdRaw.trim()
  if (!/^\d{6,30}$/.test(aeOrderId)) return { ok: false, error: "invalid_ae_order_id" }

  if (isAeDryRun()) return { ok: true, tracking: null, host: "dry_run" }
  if (!AliExpressClient.isConfigured()) return { ok: false, error: "aliexpress_api_not_configured" }

  const config = readAliExpressConfig()
  let accessToken: string
  try {
    accessToken = await getValidAccessToken()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "token_error" }
  }

  let lastError = "aliexpress_tracking_failed"
  for (const host of ALIEXPRESS_DS_SYNC_HOSTS) {
    const common = { appKey: config.appKey, appSecret: config.appSecret, accessToken, host }
    let trackingMethodFailed: string | null = null
    try {
      const payload = await callAliExpressSyncMethod({
        ...common,
        method: TRACKING_METHOD,
        bizParams: { ae_order_id: aeOrderId, language: "en_US" },
      })
      const tracking = parseAeTrackingGet(payload)
      if (tracking) return { ok: true, tracking, host }
    } catch (e) {
      trackingMethodFailed = e instanceof AliExpressApiError || e instanceof Error ? e.message : String(e)
    }

    try {
      const payload = await callAliExpressSyncMethod({
        ...common,
        method: ORDER_GET_METHOD,
        bizParams: { single_order_query: JSON.stringify({ order_id: aeOrderId }) },
      })
      return { ok: true, tracking: parseAeOrderGetTracking(payload), host }
    } catch (e) {
      const message = e instanceof AliExpressApiError || e instanceof Error ? e.message : String(e)
      lastError = trackingMethodFailed ? `${trackingMethodFailed} | ${message}` : message
      console.log("[aliexpress-ds-tracking]", {
        result: isMethodUnavailable(message) ? "method_unavailable_trying_next_host" : "error",
        aeOrderId,
        host,
        error: lastError.slice(0, 300),
      })
    }
  }
  return { ok: false, error: lastError }
}
