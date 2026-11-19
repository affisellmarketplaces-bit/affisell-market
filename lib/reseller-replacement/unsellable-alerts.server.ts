import "server-only"

import { Prisma } from "@prisma/client"
import { createTranslator } from "next-intl"

import { loadAppMessages } from "@/lib/i18n-load-messages"
import { loadAlertPreference } from "@/lib/intelligence/profit-alerts.server"
import { prisma } from "@/lib/prisma"
import { listingProblem } from "@/lib/reseller-replacement/listing-state"
import {
  readUnsellableAlertsMode,
  UNSELLABLE_LISTING_NOTIF,
  unsellableAlertId,
} from "@/lib/reseller-replacement/unsellable-alerts"

const BATCH = 500
const MAX_LISTINGS = 5000

export type UnsellableAlertsRun = {
  mode: "off" | "observe" | "enforce"
  scanned: number
  unsellable: number
  notified: number
  alreadyNotified: number
  skippedPreference: number
  truncated: boolean
}

/**
 * Daily scan of LIVE listings whose product can not be bought (same rule as the action card and the replacement page).
 * `observe` writes nothing; `enforce` claims the alert (deterministic `AuditLog` id = at most once per listing, problem
 * and 14-day window, concurrent runs included) then puts it in the reseller's bell, gated by its in-app preference.
 */
export async function runUnsellableListingAlerts(now = new Date()): Promise<UnsellableAlertsRun> {
  const mode = readUnsellableAlertsMode()
  const run: UnsellableAlertsRun = { mode, scanned: 0, unsellable: 0, notified: 0, alreadyNotified: 0, skippedPreference: 0, truncated: false }
  if (mode === "off") return run

  let cursor: string | undefined
  while (run.scanned < MAX_LISTINGS) {
    const rows = await prisma.affiliateProduct.findMany({
      where: { isListed: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        affiliateId: true,
        product: {
          select: {
            name: true,
            active: true,
            isDraft: true,
            tags: true,
            stock: true,
            hasVariants: true,
            variants: true,
            listingKind: true,
            commissionRate: true,
            offerMode: true,
          },
        },
      },
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1]!.id
    run.scanned += rows.length
    for (const r of rows) {
      const problem = listingProblem({ ...r.product, commissionRate: Number(r.product.commissionRate) || 0 })
      if (!problem) continue
      run.unsellable++
      if (mode === "observe") continue
      const pref = await loadAlertPreference(r.affiliateId)
      if (!pref.inApp) {
        run.skippedPreference++
        continue
      }
      try {
        await prisma.auditLog.create({
          data: {
            id: unsellableAlertId(r.id, problem, now),
            action: "affiliate.listing_unsellable_alerted",
            entityType: "AffiliateProduct",
            entityId: r.id,
            actorId: null,
            payload: { problem },
          },
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          run.alreadyNotified++
          continue
        }
        throw error
      }
      const t = createTranslator({
        locale: pref.locale,
        messages: loadAppMessages(pref.locale),
        namespace: "affiliate.replacement",
      }) as unknown as (key: string, values?: Record<string, string>) => string
      await prisma.notification.create({
        data: {
          userId: r.affiliateId,
          type: UNSELLABLE_LISTING_NOTIF,
          message: t("bellMessage", { product: r.product.name.slice(0, 120) }),
          // the bell builds the link to /dashboard/affiliate/products/<listingId>/replace from this id
          orderId: r.id,
        },
      })
      run.notified++
    }
    if (rows.length < BATCH) break
  }
  run.truncated = run.scanned >= MAX_LISTINGS
  if (mode === "observe") {
    console.log("[unsellable-alerts]", { result: "would_notify", count: run.unsellable, scanned: run.scanned, truncated: run.truncated })
  }
  return run
}
