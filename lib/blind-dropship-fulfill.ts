import Stripe from "stripe"

import { blindDropshipSupplierContactEmail } from "@/lib/blind-dropship-contact"
import { openBlindSecret } from "@/lib/blind-dropship-crypto"
import { blindDropshipSlackAlert } from "@/lib/blind-dropship-slack"
import { buildSupplierAdapterFromConfig } from "@/lib/suppliers/build-rest-adapter"
import type { BlindCreateOrderInput, BlindSupplierAddress } from "@/lib/suppliers/types"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

function asAddress(raw: unknown): BlindSupplierAddress {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    name: String(o.name ?? "").slice(0, 200),
    line1: String(o.line1 ?? o.line_1 ?? "").slice(0, 200),
    line2: o.line2 != null ? String(o.line2).slice(0, 200) : o.line_2 != null ? String(o.line_2).slice(0, 200) : undefined,
    city: String(o.city ?? "").slice(0, 120),
    state: o.state != null ? String(o.state).slice(0, 120) : undefined,
    postal_code: String(o.postal_code ?? o.postalCode ?? "").slice(0, 32),
    country: String(o.country ?? "").toUpperCase().slice(0, 2),
    phone: o.phone != null ? String(o.phone).slice(0, 40) : undefined,
  }
}

async function maybeStripeTransferToSupplier(args: {
  amountCents: number
  destinationAccountId: string
  orderId: string
}): Promise<void> {
  if (args.amountCents < 1) return
  const stripe = getStripeClient()
  await stripe.transfers.create({
    amount: args.amountCents,
    currency: "eur",
    destination: args.destinationAccountId,
    metadata: {
      blindDropshipOrderId: args.orderId,
    },
  } as Stripe.TransferCreateParams)
}

export async function runBlindDropshipFulfillment(orderId: string): Promise<void> {
  const order = await prisma.blindDropshipOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          blindDropshipSupplier: true,
          product: { select: { id: true, supplierId: true } },
        },
      },
    },
  })
  if (!order) {
    await blindDropshipSlackAlert(`[blind-dropship] missing order ${orderId}`)
    return
  }
  if (order.status !== "paid") {
    return
  }

  const shipping = asAddress(order.shippingAddress)

  const groups = new Map<
    string,
    {
      supplier: (typeof order.items)[0]["blindDropshipSupplier"]
      lines: typeof order.items
      costCents: number
    }
  >()

  for (const item of order.items) {
    const sid = item.blindDropshipSupplierId
    const g = groups.get(sid)
    const lineCost = item.supplierPriceAtOrderCents * item.quantity
    if (g) {
      g.lines.push(item)
      g.costCents += lineCost
    } else {
      groups.set(sid, {
        supplier: item.blindDropshipSupplier,
        lines: [item],
        costCents: lineCost,
      })
    }
  }

  try {
    if (process.env.BLIND_DROPSHIP_ENABLE_STRIPE_TRANSFERS !== "true") {
      await prisma.blindDropshipOrder.update({
        where: { id: order.id },
        data: { status: "awaiting_manual_payment", lastFulfillError: "STOP: transfers disabled — supplier not paid" },
      })
      await blindDropshipSlackAlert(`Paiement fournisseur manuel requis pour order ${orderId}`)
      throw new Error("STOP: Fournisseur non payé")
    }

    for (const [, group] of groups) {
      const cfg = (group.supplier.config ?? {}) as Record<string, unknown>
      const connect = typeof cfg.stripeConnectAccountId === "string" ? cfg.stripeConnectAccountId.trim() : ""
      if (!connect) {
        await prisma.blindDropshipOrder.update({
          where: { id: order.id },
          data: {
            status: "awaiting_manual_payment",
            lastFulfillError: "STOP: missing stripeConnectAccountId for a supplier group",
          },
        })
        await blindDropshipSlackAlert(
          `Paiement fournisseur manuel requis pour order ${orderId} (Stripe Connect account missing)`
        )
        throw new Error("STOP: Fournisseur non payé")
      }
      try {
        await maybeStripeTransferToSupplier({
          amountCents: group.costCents,
          destinationAccountId: connect,
          orderId: order.id,
        })
      } catch (te) {
        const tm = te instanceof Error ? te.message : String(te)
        await prisma.blindDropshipOrder.update({
          where: { id: order.id },
          data: { status: "awaiting_manual_payment", lastFulfillError: `stripe_transfer_failed:${tm}` },
        })
        await blindDropshipSlackAlert(`Paiement fournisseur échoué order ${orderId}: ${tm}`)
        throw new Error(`STOP: Fournisseur non payé (${tm})`)
      }
    }

    const contactEmail = blindDropshipSupplierContactEmail(order.id)
    const reference = `bd-${order.id}`

    for (const [, group] of groups) {
      const apiKey = openBlindSecret(group.supplier.apiKeyEncrypted)
      const adapter = buildSupplierAdapterFromConfig({
        apiEndpoint: group.supplier.apiEndpoint,
        apiKeyPlain: apiKey,
        config: (group.supplier.config ?? {}) as Record<string, unknown>,
      })
      const input: BlindCreateOrderInput = {
        shipping,
        contact_email: contactEmail,
        reference,
        items: group.lines.map((it) => ({
          sku: it.supplierSkuAtOrder,
          quantity: it.quantity,
          unit_price_cents: it.supplierPriceAtOrderCents,
        })),
      }
      const created = await adapter.createOrder(input)
      await prisma.$transaction(
        group.lines.map((it) =>
          prisma.blindDropshipOrderItem.update({
            where: { id: it.id },
            data: { supplierOrderId: created.supplier_order_id },
          })
        )
      )
    }

    await prisma.blindDropshipOrder.update({
      where: { id: order.id },
      data: { status: "fulfilling", lastFulfillError: null },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const current = await prisma.blindDropshipOrder.findUnique({
      where: { id: order.id },
      select: { status: true },
    })
    if (current?.status !== "awaiting_manual_payment") {
      await prisma.blindDropshipOrder.update({
        where: { id: order.id },
        data: { status: "failed", lastFulfillError: msg.slice(0, 4000) },
      })
      await blindDropshipSlackAlert(`[blind-dropship] fulfill FAILED order=${order.id}\n${msg}`)
    }
    throw e
  }
}
