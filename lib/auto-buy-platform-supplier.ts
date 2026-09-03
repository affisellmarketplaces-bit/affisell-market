import { ensureMerchantStore } from "@/lib/ensure-store"
import {
  AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
  AFFISELL_AUTOBUY_SUPPLIER_NAME,
} from "@/lib/auto-buy-platform-supplier-shared"
import { prisma } from "@/lib/prisma"

export {
  AFFISELL_AUTOBUY_IMPORT_SOURCE,
  AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
  AFFISELL_AUTOBUY_SUPPLIER_NAME,
} from "@/lib/auto-buy-platform-supplier-shared"

export type AffisellAutoBuySupplier = {
  id: string
  email: string
  name: string
  storeSlug: string | null
  storeName: string | null
  created: boolean
}

/**
 * Idempotent platform AutoBuy supplier + boutique.
 * Products enlisted here are published into the affiliate catalog for resellers.
 */
export async function ensureAffisellAutoBuySupplier(): Promise<AffisellAutoBuySupplier> {
  const existing = await prisma.user.findUnique({
    where: { email: AFFISELL_AUTOBUY_SUPPLIER_EMAIL },
    select: {
      id: true,
      role: true,
      name: true,
      store: { select: { slug: true, name: true } },
    },
  })

  if (existing) {
    const patch: {
      role?: string
      name?: string
      isVerifiedSupplier?: boolean
      verifiedAt?: Date
    } = {}
    if (existing.role !== "SUPPLIER") patch.role = "SUPPLIER"
    if (existing.name !== AFFISELL_AUTOBUY_SUPPLIER_NAME) {
      patch.name = AFFISELL_AUTOBUY_SUPPLIER_NAME
    }
    if (Object.keys(patch).length > 0) {
      patch.isVerifiedSupplier = true
      patch.verifiedAt = new Date()
      await prisma.user.update({ where: { id: existing.id }, data: patch })
    }

    const store = await ensureMerchantStore({
      userId: existing.id,
      email: AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
      displayName: AFFISELL_AUTOBUY_SUPPLIER_NAME,
    })

    // Keep store brand name stable (ensureMerchantStore only creates once)
    if (store.name !== AFFISELL_AUTOBUY_SUPPLIER_NAME) {
      await prisma.store.update({
        where: { id: store.id },
        data: { name: AFFISELL_AUTOBUY_SUPPLIER_NAME },
      })
    }

    return {
      id: existing.id,
      email: AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
      name: AFFISELL_AUTOBUY_SUPPLIER_NAME,
      storeSlug: store.slug,
      storeName: AFFISELL_AUTOBUY_SUPPLIER_NAME,
      created: false,
    }
  }

  const created = await prisma.user.create({
    data: {
      email: AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
      name: AFFISELL_AUTOBUY_SUPPLIER_NAME,
      role: "SUPPLIER",
      isVerifiedSupplier: true,
      verifiedAt: new Date(),
      supplierTrustTier: "ORBITAL",
    },
    select: { id: true },
  })

  const store = await ensureMerchantStore({
    userId: created.id,
    email: AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
    displayName: AFFISELL_AUTOBUY_SUPPLIER_NAME,
  })

  if (store.name !== AFFISELL_AUTOBUY_SUPPLIER_NAME) {
    await prisma.store.update({
      where: { id: store.id },
      data: { name: AFFISELL_AUTOBUY_SUPPLIER_NAME },
    })
  }

  console.log("[auto-buy-platform]", {
    result: "supplier_created",
    supplierId: created.id,
    storeSlug: store.slug,
  })

  return {
    id: created.id,
    email: AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
    name: AFFISELL_AUTOBUY_SUPPLIER_NAME,
    storeSlug: store.slug,
    storeName: AFFISELL_AUTOBUY_SUPPLIER_NAME,
    created: true,
  }
}

/** True when this user id is the platform AutoBuy catalog owner. */
export async function isAffisellAutoBuySupplierId(userId: string): Promise<boolean> {
  const row = await prisma.user.findFirst({
    where: { id: userId, email: AFFISELL_AUTOBUY_SUPPLIER_EMAIL },
    select: { id: true },
  })
  return Boolean(row)
}
