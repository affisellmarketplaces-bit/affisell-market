import { assertAutoDsStoreConfigured, getAutoDsConfig } from "@/lib/autods/config"
import {
  buildAutoDsCreateOrderPayload,
  extractAutoDsOrderId,
  mapAutoDsRemoteStatus,
  orderEligibleForAutoDs,
} from "@/lib/autods/build-create-order-payload"
import type { AutoDsCreateOrderPayload, AutoDsSubmitResult } from "@/lib/autods/types"
import { prisma } from "@/lib/prisma"

async function postAutoDsOrder(
  url: string,
  apiKey: string,
  payload: AutoDsCreateOrderPayload
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  })

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  return { status: res.status, body }
}

/** Idempotent: create AutoDS order once per Affisell paid order. */
export async function submitPaidOrderToAutoDS(orderId: string): Promise<AutoDsSubmitResult> {
  const config = getAutoDsConfig()
  if (!config) {
    return { ok: false, error: "autods_not_configured", retryable: false }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: true },
  })

  if (!order) return { ok: false, error: "order_not_found", retryable: false }
  if (order.status !== "paid") return { ok: false, error: "order_not_paid", retryable: false }
  if (order.autodsOrderId) {
    return {
      ok: true,
      autodsOrderId: order.autodsOrderId,
      status: order.autodsStatus ?? "PROCESSING",
      alreadyExists: true,
    }
  }

  if (!orderEligibleForAutoDs(order.product)) {
    return { ok: false, error: "product_not_autods", retryable: false }
  }

  if (order.listingKindSnapshot && order.listingKindSnapshot !== "PHYSICAL") {
    return { ok: false, error: "non_physical_order", retryable: false }
  }

  try {
    assertAutoDsStoreConfigured(config)
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "autods_store_misconfigured",
      retryable: false,
    }
  }

  const claim = await prisma.order.updateMany({
    where: { id: orderId, autodsOrderId: null, status: "paid" },
    data: { autodsStatus: "PENDING" },
  })
  if (claim.count === 0) {
    const again = await prisma.order.findUnique({
      where: { id: orderId },
      select: { autodsOrderId: true, autodsStatus: true },
    })
    if (again?.autodsOrderId) {
      return {
        ok: true,
        autodsOrderId: again.autodsOrderId,
        status: again.autodsStatus ?? "PROCESSING",
        alreadyExists: true,
      }
    }
    return { ok: false, error: "autods_claim_failed", retryable: true }
  }

  let payload: AutoDsCreateOrderPayload
  try {
    payload = buildAutoDsCreateOrderPayload({ order, product: order.product, config })
  } catch (e) {
    const message = e instanceof Error ? e.message : "payload_build_failed"
    await prisma.order.update({
      where: { id: orderId },
      data: { autodsStatus: "FAILED" },
    })
    return { ok: false, error: message, retryable: false }
  }

  try {
    const { status, body } = await postAutoDsOrder(config.createOrderUrl, config.apiKey, payload)

    if (status >= 500) {
      await prisma.order.update({
        where: { id: orderId },
        data: { autodsStatus: "FAILED" },
      })
      return { ok: false, error: `autods_http_${status}`, retryable: true }
    }

    if (status >= 400) {
      const detail =
        body && typeof body === "object" && "error" in body
          ? JSON.stringify((body as { error: unknown }).error)
          : `autods_http_${status}`
      await prisma.order.update({
        where: { id: orderId },
        data: { autodsStatus: "FAILED" },
      })
      console.error("[autods]", { orderId, result: "create_rejected", status, detail })
      return { ok: false, error: detail, retryable: status === 429 }
    }

    const autodsOrderId = extractAutoDsOrderId(body) ?? orderId
    const remoteStatus = mapAutoDsRemoteStatus(body)

    await prisma.order.update({
      where: { id: orderId },
      data: {
        autodsOrderId,
        autodsStatus: remoteStatus,
        fulfilledAt: new Date(),
        fulfillmentStatus: "ORDERED",
      },
    })

    console.log("[autods]", {
      orderId,
      autodsOrderId,
      autodsStatus: remoteStatus,
      result: status === 200 ? "existing_order" : "created",
    })

    return {
      ok: true,
      autodsOrderId,
      status: remoteStatus,
      alreadyExists: status === 200,
    }
  } catch (e) {
    await prisma.order.update({
      where: { id: orderId },
      data: { autodsStatus: "FAILED" },
    })
    console.error("[autods]", {
      orderId,
      result: "create_failed",
      error: e instanceof Error ? e.message : String(e),
    })
    return {
      ok: false,
      error: e instanceof Error ? e.message : "autods_network_error",
      retryable: true,
    }
  }
}

/** Submit all eligible paid rows for a Stripe checkout session. */
export async function triggerAutoDsForStripeSession(stripeSessionId: string): Promise<void> {
  if (!getAutoDsConfig()) return

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId }, { stripeSessionId: { startsWith: `${stripeSessionId}:line:` } }],
      status: "paid",
      autodsOrderId: null,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  for (const row of orders) {
    const result = await submitPaidOrderToAutoDS(row.id)
    if (!result.ok && result.retryable) {
      console.error("[autods]", { orderId: row.id, result: "retryable_failure", error: result.error })
    }
  }
}
