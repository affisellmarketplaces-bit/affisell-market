import "server-only"

import { AFFISELL_AUTOBUY_SUPPLIER_EMAIL } from "@/lib/auto-buy-platform-supplier-shared"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"
import { revalidateSupplierShopfront } from "@/lib/revalidate-supplier-shopfront"
import { storePathOnPlatform } from "@/lib/store-public-url"

const PLATFORM_SUPPLIER_EMAILS = [
  AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
  "import-vault@affisell.internal",
] as const

export type PushProductToSupplierResult =
  | {
      ok: true
      result: "already_owned" | "reassigned" | "published_only"
      productId: string
      supplierId: string
      storeSlug: string | null
      storePath: string | null
      published: boolean
      previousSupplierId: string
    }
  | { ok: false; error: string }

/**
 * Push an AutoBuy (or platform) product onto a merchant supplier boutique.
 * Idempotent: already owned → no-op. Keeps SupplierLink + variants intact.
 */
export async function pushProductToSupplier(input: {
  productId: string
  targetSupplierId: string
  /** Publish to boutique (active + !draft). Default true. */
  publish?: boolean
  /**
   * Allow taking a product from a non-platform merchant.
   * Default false — refuse ownership_conflict.
   */
  force?: boolean
  adminUserId: string
}): Promise<PushProductToSupplierResult> {
  const productId = input.productId.trim()
  const targetSupplierId = input.targetSupplierId.trim()
  const publish = input.publish !== false
  const force = input.force === true

  if (!productId || !targetSupplierId) {
    return { ok: false, error: "invalid_input" }
  }

  const [product, target] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        supplierId: true,
        active: true,
        isDraft: true,
        name: true,
        supplierLink: { select: { id: true, isActive: true, autoBuyEnabled: true } },
        supplier: { select: { id: true, email: true, role: true } },
      },
    }),
    prisma.user.findFirst({
      where: { id: targetSupplierId, role: "SUPPLIER" },
      select: {
        id: true,
        email: true,
        name: true,
        store: { select: { slug: true, name: true } },
      },
    }),
  ])

  if (!product) return { ok: false, error: "product_not_found" }
  if (!target) return { ok: false, error: "supplier_not_found" }

  const platformOwners = await prisma.user.findMany({
    where: { email: { in: [...PLATFORM_SUPPLIER_EMAILS] } },
    select: { id: true },
  })
  const platformIds = new Set(platformOwners.map((u) => u.id))
  const fromPlatform = platformIds.has(product.supplierId)

  if (product.supplierId === target.id) {
    let publishedOnly = false
    if (publish && (!product.active || product.isDraft)) {
      await prisma.product.update({
        where: { id: product.id },
        data: { active: true, isDraft: false },
      })
      publishedOnly = true
    }
    const store = await ensureMerchantStore({
      userId: target.id,
      email: target.email,
      displayName: target.name,
    })
    void revalidateSupplierShopfront(target.id)
    console.log("[admin-push-to-supplier]", {
      result: publishedOnly ? "published_only" : "already_owned",
      productId: product.id,
      supplierId: target.id,
      adminUserId: input.adminUserId,
    })
    return {
      ok: true,
      result: publishedOnly ? "published_only" : "already_owned",
      productId: product.id,
      supplierId: target.id,
      storeSlug: store.slug,
      storePath: storePathOnPlatform({ slug: store.slug, role: "SUPPLIER" }),
      published: publish || (product.active && !product.isDraft),
      previousSupplierId: product.supplierId,
    }
  }

  if (!fromPlatform && !force) {
    return { ok: false, error: "ownership_conflict" }
  }

  const store = await ensureMerchantStore({
    userId: target.id,
    email: target.email,
    displayName: target.name,
  })

  await prisma.product.update({
    where: { id: product.id },
    data: {
      supplierId: target.id,
      ...(publish ? { active: true, isDraft: false } : {}),
    },
  })

  // Keep AE auto-buy link active when present
  if (product.supplierLink?.id) {
    await prisma.supplierLink.update({
      where: { id: product.supplierLink.id },
      data: { isActive: true },
    })
  }

  void revalidateSupplierShopfront(target.id)
  if (!platformIds.has(product.supplierId)) {
    void revalidateSupplierShopfront(product.supplierId)
  }

  console.log("[admin-push-to-supplier]", {
    result: "reassigned",
    productId: product.id,
    fromSupplierId: product.supplierId,
    toSupplierId: target.id,
    publish,
    force,
    adminUserId: input.adminUserId,
  })

  return {
    ok: true,
    result: "reassigned",
    productId: product.id,
    supplierId: target.id,
    storeSlug: store.slug,
    storePath: storePathOnPlatform({ slug: store.slug, role: "SUPPLIER" }),
    published: publish,
    previousSupplierId: product.supplierId,
  }
}

export type AdminSupplierBoutiqueOption = {
  id: string
  name: string | null
  email: string
  storeSlug: string | null
  storeName: string | null
  isPlatformAutoBuy: boolean
}

export async function listAdminSupplierBoutiques(
  take = 200
): Promise<AdminSupplierBoutiqueOption[]> {
  const rows = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    select: {
      id: true,
      name: true,
      email: true,
      store: { select: { slug: true, name: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: Math.min(300, Math.max(1, take)),
  })

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    storeSlug: r.store?.slug ?? null,
    storeName: r.store?.name ?? null,
    isPlatformAutoBuy: r.email === AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
  }))
}
