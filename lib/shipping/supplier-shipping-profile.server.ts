import "server-only"

import { Prisma } from "@prisma/client"

import {
  parseShopShippingOffers,
  type ShopShippingOffer,
} from "@/lib/shipping/supplier-carrier-offers-shared"
import { prisma } from "@/lib/prisma"

function isMissingTableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /SupplierShippingProfile/i.test(msg) && /does not exist|P2021|P2010|relation/i.test(msg)
}

let ensured = false

/** Idempotent DDL (same safety net as the carrier column): the profile keeps working if `migrate` lags on an env. */
export async function ensureSupplierShippingProfileTable(): Promise<void> {
  if (ensured) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SupplierShippingProfile" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "offers" JSONB NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SupplierShippingProfile_pkey" PRIMARY KEY ("id")
    )`)
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "SupplierShippingProfile_userId_key" ON "SupplierShippingProfile"("userId")`
  )
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierShippingProfile_userId_fkey') THEN
        ALTER TABLE "SupplierShippingProfile" ADD CONSTRAINT "SupplierShippingProfile_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`)
  ensured = true
}

/**
 * The supplier's shop shipping offers. NEVER throws: on any error (including a not-yet-migrated table) it
 * returns [] — and an empty profile means the buyer sees no shipping block at all, which is the safe default.
 */
export async function loadSupplierShopShippingOffers(supplierUserId: string): Promise<ShopShippingOffer[]> {
  if (!supplierUserId) return []
  try {
    const row = await prisma.supplierShippingProfile.findUnique({
      where: { userId: supplierUserId },
      select: { offers: true },
    })
    return parseShopShippingOffers(row?.offers)
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[supplier-shipping-profile] load failed", error instanceof Error ? error.message : error)
    }
    return []
  }
}

/** Offers for several suppliers in one query (listing pages). */
export async function loadSupplierShopShippingOffersMap(
  supplierUserIds: readonly string[]
): Promise<Map<string, ShopShippingOffer[]>> {
  const ids = [...new Set(supplierUserIds.filter(Boolean))]
  const out = new Map<string, ShopShippingOffer[]>()
  if (ids.length === 0) return out
  try {
    const rows = await prisma.supplierShippingProfile.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, offers: true },
    })
    for (const r of rows) out.set(r.userId, parseShopShippingOffers(r.offers))
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error("[supplier-shipping-profile] batch load failed", error instanceof Error ? error.message : error)
    }
  }
  return out
}

/** Saves (replaces) the shop profile. Input is re-validated server-side; returns what was actually stored. */
export async function saveSupplierShopShippingOffers(
  supplierUserId: string,
  raw: unknown
): Promise<ShopShippingOffer[]> {
  const offers = parseShopShippingOffers(raw)
  const write = () =>
    prisma.supplierShippingProfile.upsert({
      where: { userId: supplierUserId },
      create: { userId: supplierUserId, offers: offers as unknown as Prisma.InputJsonValue },
      update: { offers: offers as unknown as Prisma.InputJsonValue },
      select: { offers: true },
    })
  try {
    const row = await write()
    return parseShopShippingOffers(row.offers)
  } catch (error) {
    if (!isMissingTableError(error)) throw error
    await ensureSupplierShippingProfileTable()
    const row = await write()
    return parseShopShippingOffers(row.offers)
  }
}
