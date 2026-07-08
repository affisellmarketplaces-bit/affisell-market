import { hash } from "bcryptjs"

import {
  DEMO_LAB_ACCOUNT_META,
  DEMO_LAB_EMAIL_BY_PERSONA,
  DEMO_LAB_TAG,
} from "@/lib/demo/demo-accounts-shared"
import { resolveDemoPassword } from "@/lib/demo/demo-accounts-config"
import { demoPersonaToPrisma, type DemoPersonaKey } from "@/lib/demo/demo-shared"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { logBusiness } from "@/lib/business-log"
import { prisma } from "@/lib/prisma"

const DEMO_PRODUCT_NAME = "【Demo Lab】 Aurora Wireless Earbuds"
/** Stable CDN hero — demo SKU must not ship with empty images[] on a live listing. */
const DEMO_PRODUCT_IMAGE_URL =
  "https://images.unsplash.com/photo-1590658268037-6bf12f032669?auto=format&fit=crop&w=800&q=80"

function prismaRoleForPersona(persona: DemoPersonaKey): string {
  if (persona === "buyer") return "CUSTOMER"
  return demoPersonaToPrisma(persona)
}

async function ensureMerchantLegalApproved(userId: string) {
  const existing = await prisma.merchantLegalProfile.findUnique({ where: { userId } })
  if (existing?.verificationStatus === "APPROVED") return existing

  return prisma.merchantLegalProfile.upsert({
    where: { userId },
    create: {
      userId,
      legalStatus: "AUTO_ENTREPRENEUR",
      verificationStatus: "APPROVED",
      legalEntityName: "Affisell Demo Lab",
      tradeName: "Demo Lab Sandbox",
      countryCode: "FR",
      reviewedAt: new Date(),
    },
    update: {
      verificationStatus: "APPROVED",
      reviewedAt: new Date(),
      rejectionReason: null,
    },
  })
}

async function ensureDemoSupplierCatalog(supplierId: string) {
  let product = await prisma.product.findFirst({
    where: { supplierId, tags: { has: DEMO_LAB_TAG } },
  })

  if (!product) {
    product = await prisma.product.create({
      data: {
        supplierId,
        name: DEMO_PRODUCT_NAME,
        description:
          "Sandbox SKU for Affisell Demo Lab. Orders and payouts are not executed against real inventory.",
        basePriceCents: 2499,
        commissionRate: 12,
        supplierCommissionRateBps: 1200,
        tags: [DEMO_LAB_TAG],
        images: [DEMO_PRODUCT_IMAGE_URL],
        active: true,
        isDraft: false,
        stock: 99,
      },
    })
    console.log("[demo-lab-ensure]", { supplierId, productId: product.id, result: "product_created" })
  } else if (!product.images?.length) {
    product = await prisma.product.update({
      where: { id: product.id },
      data: { images: [DEMO_PRODUCT_IMAGE_URL] },
    })
    console.log("[demo-lab-ensure]", { supplierId, productId: product.id, result: "product_images_backfilled" })
  }

  return product
}

async function ensureDemoAffiliateListing(affiliateId: string, productId: string) {
  const existing = await prisma.affiliateProduct.findFirst({
    where: { affiliateId, productId },
  })
  if (existing) {
    if (!existing.isListed) {
      await prisma.affiliateProduct.update({
        where: { id: existing.id },
        data: { isListed: true },
      })
    }
    return existing
  }

  return prisma.affiliateProduct.create({
    data: {
      affiliateId,
      productId,
      sellingPriceCents: 3999,
      marginCents: 1500,
      isListed: true,
    },
  })
}

/**
 * Idempotent: upsert demo user, store, KYC (merchants), sample catalog.
 */
export async function ensureDemoLabUser(persona: DemoPersonaKey): Promise<{ userId: string }> {
  const password = resolveDemoPassword(persona)
  if (!password) {
    throw new Error("demo_password_not_configured")
  }

  const meta = DEMO_LAB_ACCOUNT_META[persona]
  const email = DEMO_LAB_EMAIL_BY_PERSONA[persona]
  const role = prismaRoleForPersona(persona)
  const passwordHash = await hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: meta.displayName,
      password: passwordHash,
      role,
      emailVerified: new Date(),
    },
    update: {
      name: meta.displayName,
      password: passwordHash,
      role,
    },
  })

  if (persona === "supplier" || persona === "affiliate") {
    await ensureMerchantStore({ userId: user.id, email, displayName: meta.displayName })
    await ensureMerchantLegalApproved(user.id)
  }

  if (persona === "supplier") {
    await ensureDemoSupplierCatalog(user.id)
  }

  if (persona === "affiliate") {
    const supplier = await prisma.user.findUnique({
      where: { email: DEMO_LAB_EMAIL_BY_PERSONA.supplier },
      select: { id: true },
    })
    if (supplier) {
      const product = await prisma.product.findFirst({
        where: { supplierId: supplier.id, tags: { has: DEMO_LAB_TAG } },
        select: { id: true },
      })
      if (product) {
        await ensureDemoAffiliateListing(user.id, product.id)
      } else {
        const createdProduct = await ensureDemoSupplierCatalog(supplier.id)
        await ensureDemoAffiliateListing(user.id, createdProduct.id)
      }
    }
  }

  logBusiness("demo-lab-ensure", { result: "ok", persona, userId: user.id })
  console.log("[demo-lab-ensure]", { persona, userId: user.id, email, result: "ok" })
  return { userId: user.id }
}

export async function ensureAllDemoLabUsers(): Promise<void> {
  const personas: DemoPersonaKey[] = ["supplier", "affiliate", "buyer"]
  for (const persona of personas) {
    await ensureDemoLabUser(persona)
  }
}
