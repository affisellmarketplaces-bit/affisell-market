import "server-only"

import { isAeDryRun } from "@/lib/fulfillment/ae-dry-run"
import { getValidAccessToken } from "@/lib/aliexpress-oauth"
import { AliExpressApiError, AliExpressClient } from "@/lib/aliexpress-open-api"
import { ALIEXPRESS_DS_SYNC_HOSTS, callAliExpressSyncMethod } from "@/lib/aliexpress-ds-sync"
import { readAliExpressConfig } from "@/lib/aliexpress-config"

/**
 * `aliexpress.ds.order.afterpay` — the one order-lifecycle method AliExpress's Open Platform
 * exposes to a dropshipper after payment (confirmed against the live API reference at
 * https://openservice.aliexpress.com/doc/api.htm, "AE-Dropshipper" category — there is no
 * `*.order.cancel` method in that namespace). Its own documentation is thin (just `req:
 * {order_id}` in, `result: boolean` out) and doesn't say whether a `true` result is an instant
 * cancellation or a request still subject to the seller's approval — AliExpress's own general
 * policy is that a paid-but-unshipped order needs seller approval to cancel. So a `true` result
 * here is treated as "cancellation requested successfully," not as a guaranteed refund — callers
 * should still keep the order visible for human follow-up rather than closing the loop silently.
 */
const CANCEL_METHOD = "aliexpress.ds.order.afterpay"
const ORDER_STATUS_METHOD = "aliexpress.trade.ds.order.get"

export type CancelAliExpressDsOrderResult =
  | { ok: true; requested: boolean; orderStatusAfter: string | null; host: string }
  | { ok: false; error: string }

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function unwrap(payload: unknown, responseKeys: string[]): Record<string, unknown> | null {
  const root = asRecord(payload)
  if (!root) return null
  for (const key of responseKeys) {
    const node = asRecord(root[key])
    if (node) return node
  }
  return root
}

function isRetryableMethodError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("api path is invalid") ||
    m.includes("isv.api-not-exist") ||
    m.includes("api not exist") ||
    m.includes("invalid-method") ||
    m.includes("method not support") ||
    m.includes("permission deny") ||
    m.includes("not authorized")
  )
}

async function queryOrderStatus(args: {
  aeOrderId: string
  appKey: string
  appSecret: string
  accessToken: string
  host: string
}): Promise<string | null> {
  try {
    const payload = await callAliExpressSyncMethod({
      method: ORDER_STATUS_METHOD,
      bizParams: { single_order_query: JSON.stringify({ order_id: args.aeOrderId }) },
      appKey: args.appKey,
      appSecret: args.appSecret,
      accessToken: args.accessToken,
      host: args.host,
    })
    const node = unwrap(payload, ["aliexpress_trade_ds_order_get_response"])
    const result = asRecord(node?.result) ?? node
    const status = result?.order_status
    return typeof status === "string" && status.trim() ? status.trim() : null
  } catch (e) {
    console.log("[aliexpress-ds-cancel]", {
      result: "status_check_failed",
      aeOrderId: args.aeOrderId,
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/** Requests cancellation of an already-placed AliExpress DS order via the official afterpay API. */
export async function cancelAliExpressDsOrder(aeOrderId: string): Promise<CancelAliExpressDsOrderResult> {
  const orderId = aeOrderId.trim()
  if (!orderId) return { ok: false, error: "missing_order_id" }

  if (isAeDryRun()) {
    console.log("[aliexpress-ds-cancel]", { result: "dry_run", aeOrderId: orderId })
    return { ok: true, requested: true, orderStatusAfter: null, host: "dry_run" }
  }

  if (!AliExpressClient.isConfigured()) {
    return { ok: false, error: "aliexpress_api_not_configured" }
  }

  const config = readAliExpressConfig()
  let accessToken: string
  try {
    accessToken = await getValidAccessToken()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "token_error" }
  }

  let lastError = "aliexpress_cancel_failed"

  for (const host of ALIEXPRESS_DS_SYNC_HOSTS) {
    try {
      const payload = await callAliExpressSyncMethod({
        method: CANCEL_METHOD,
        bizParams: { req: JSON.stringify({ order_id: orderId }) },
        appKey: config.appKey,
        appSecret: config.appSecret,
        accessToken,
        host,
      })
      const node = unwrap(payload, ["aliexpress_ds_order_afterpay_response"])
      const resultFlag = node?.result
      const requested = resultFlag === true || resultFlag === "true"

      const orderStatusAfter = await queryOrderStatus({
        aeOrderId: orderId,
        appKey: config.appKey,
        appSecret: config.appSecret,
        accessToken,
        host,
      })

      console.log("[aliexpress-ds-cancel]", {
        result: requested ? "requested" : "not_requested",
        aeOrderId: orderId,
        host,
        orderStatusAfter,
        rspMsg: node?.rsp_msg ?? null,
      })

      return { ok: true, requested, orderStatusAfter, host }
    } catch (e) {
      const message =
        e instanceof AliExpressApiError ? e.message : e instanceof Error ? e.message : String(e)
      lastError = message
      console.log("[aliexpress-ds-cancel]", {
        result: isRetryableMethodError(message) ? "method_unavailable_trying_next_host" : "error",
        aeOrderId: orderId,
        host,
        error: message,
      })
    }
  }

  return { ok: false, error: lastError }
}
