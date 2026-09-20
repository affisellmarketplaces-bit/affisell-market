import "server-only"

import { formatInvoiceNumber, PLATFORM_ISSUER_KEY } from "@/lib/invoices/invoice-number"
import { prisma } from "@/lib/prisma"

export type CustomerInvoiceStamp = { number: string; issuedAt: Date }

/**
 * Number of the customer invoice of an order — assigned ONCE (first invoice issued), then always returned as is.
 *
 * Continuous numbering (French rule): the order row is locked (`FOR UPDATE`) and the per-issuer/year counter is
 * incremented in the SAME transaction that stamps the order — a rollback never burns a number and two concurrent
 * downloads can never take two numbers for one order. The issue date is the moment of first issue, so numbers
 * and dates increase together.
 *
 * Issuer = the selling affiliate (the commissionnaire that issues the customer invoice); the platform when the
 * order has none. Never throws into the caller's invoice download: on any error the caller falls back to no number.
 */
export async function ensureCustomerInvoiceNumber(orderId: string, now: Date = new Date()): Promise<CustomerInvoiceStamp> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ customerInvoiceNumber: string | null; customerInvoicedAt: Date | null; affiliateId: string | null }>
    >`SELECT "customerInvoiceNumber", "customerInvoicedAt", "affiliateId" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`
    const row = rows[0]
    if (!row) throw new Error("order_not_found")
    if (row.customerInvoiceNumber) {
      return { number: row.customerInvoiceNumber, issuedAt: row.customerInvoicedAt ?? now }
    }

    const issuerKey = row.affiliateId?.trim() || PLATFORM_ISSUER_KEY
    const year = now.getUTCFullYear()
    const counter = await tx.$queryRaw<Array<{ lastNumber: number }>>`
      INSERT INTO "InvoiceSequence" ("issuerKey", "year", "lastNumber", "updatedAt")
      VALUES (${issuerKey}, ${year}, 1, ${now})
      ON CONFLICT ("issuerKey", "year")
      DO UPDATE SET "lastNumber" = "InvoiceSequence"."lastNumber" + 1, "updatedAt" = ${now}
      RETURNING "lastNumber"`
    const number = formatInvoiceNumber(issuerKey, year, Number(counter[0]!.lastNumber))

    await tx.order.update({
      where: { id: orderId },
      data: { customerInvoiceNumber: number, customerInvoicedAt: now },
    })
    return { number, issuedAt: now }
  })
}
