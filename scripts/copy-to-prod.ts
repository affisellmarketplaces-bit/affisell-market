/**
 * Copy data from LOCAL (DATABASE_URL) to PRODUCTION (PROD_DB).
 *
 * Usage (do not commit secrets):
 *   DATABASE_URL="postgresql://..." PROD_DB="postgresql://..." npm run db:copy
 *
 * Or add PROD_DB to .env.local and run: npm run db:copy
 *
 * Uses upsert by primary key (or unique key for VerificationToken) — never deletes prod rows.
 */

import "dotenv/config"

import { Prisma, PrismaClient } from "@prisma/client"

/** Map DB JSON nulls to Prisma input (read rows use `JsonValue` with `null`). */
function jsonOrNull(v: Prisma.JsonValue | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (v === undefined) return undefined
  if (v === null) return Prisma.JsonNull
  return v as Prisma.InputJsonValue
}

function userPayload(row: Awaited<ReturnType<PrismaClient["user"]["findMany"]>>[number]) {
  const {
    supplierRecentCategories,
    supplierMetrics,
    stripeCapabilities,
    cookieConsent,
    ...rest
  } = row
  return {
    ...rest,
    supplierRecentCategories: (supplierRecentCategories ?? []) as Prisma.InputJsonValue,
    supplierMetrics: jsonOrNull(supplierMetrics),
    stripeCapabilities: jsonOrNull(stripeCapabilities),
    cookieConsent: jsonOrNull(cookieConsent),
  } satisfies Prisma.UserUncheckedCreateInput
}

function storePayload(row: Awaited<ReturnType<PrismaClient["store"]["findMany"]>>[number]) {
  const { followers, shipFromAddress, returnAddress, storefrontTheme, ...rest } = row
  return {
    ...rest,
    followers: jsonOrNull(followers),
    shipFromAddress: jsonOrNull(shipFromAddress),
    returnAddress: jsonOrNull(returnAddress),
    storefrontTheme: jsonOrNull(storefrontTheme),
    vercelDomainStatus: rest.vercelDomainStatus ?? null,
    vercelDomainError: rest.vercelDomainError ?? null,
    vercelDomainSyncedAt: rest.vercelDomainSyncedAt ?? null,
  } satisfies Prisma.StoreUncheckedCreateInput
}

function productPayload(row: Awaited<ReturnType<PrismaClient["product"]["findMany"]>>[number]) {
  return {
    ...row,
    colorImages: jsonOrNull(row.colorImages),
    variants: jsonOrNull(row.variants),
    customColumns: jsonOrNull(row.customColumns),
    variantMapping: jsonOrNull(row.variantMapping),
  } satisfies Prisma.ProductUncheckedCreateInput
}

function orderPayload(row: Awaited<ReturnType<PrismaClient["order"]["findMany"]>>[number]) {
  const { fulfillmentErrors, ...rest } = row
  return {
    ...rest,
    shippingAddress: jsonOrNull(row.shippingAddress) as Prisma.InputJsonValue,
    fulfillmentErrors:
      fulfillmentErrors == null
        ? undefined
        : (jsonOrNull(fulfillmentErrors) as Prisma.InputJsonValue),
  } satisfies Prisma.OrderUncheckedCreateInput
}

const localUrl = process.env.DATABASE_URL?.trim()
const prodUrl = process.env.PROD_DB?.trim()

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Missing ${name}. Set DATABASE_URL (local) and PROD_DB (production).`)
    process.exit(1)
  }
  return value
}

async function main() {
  const dbUrl = requireEnv("DATABASE_URL", localUrl)
  const prodDbUrl = requireEnv("PROD_DB", prodUrl)

  const localDb = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ["warn", "error"],
  })
  const prodDb = new PrismaClient({
    datasources: { db: { url: prodDbUrl } },
    log: ["warn", "error"],
  })

  const counts = {
    users: 0,
    accounts: 0,
    sessions: 0,
    verificationTokens: 0,
    stores: 0,
    products: 0,
    affiliateProducts: 0,
    carts: 0,
    cartItems: 0,
    communityPosts: 0,
    follows: 0,
    orders: 0,
    notifications: 0,
  }

  const errors: string[] = []

  function logErr(ctx: string, err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`${ctx}: ${msg}`)
    console.error(`  [error] ${ctx}: ${msg}`)
  }

  try {
    console.log("Reading from local database…")

    const users = await localDb.user.findMany()
    for (const row of users) {
      try {
        const payload = userPayload(row)
        await prodDb.user.upsert({
          where: { id: row.id },
          create: payload,
          update: payload,
        })
        counts.users++
      } catch (e) {
        logErr(`User ${row.id}`, e)
      }
    }

    const accounts = await localDb.account.findMany()
    for (const row of accounts) {
      try {
        await prodDb.account.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        })
        counts.accounts++
      } catch (e) {
        logErr(`Account ${row.id}`, e)
      }
    }

    const sessions = await localDb.session.findMany()
    for (const row of sessions) {
      try {
        await prodDb.session.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        })
        counts.sessions++
      } catch (e) {
        logErr(`Session ${row.id}`, e)
      }
    }

    const tokens = await localDb.verificationToken.findMany()
    for (const row of tokens) {
      try {
        await prodDb.verificationToken.upsert({
          where: { token: row.token },
          create: row,
          update: {
            identifier: row.identifier,
            expires: row.expires,
          },
        })
        counts.verificationTokens++
      } catch (e) {
        logErr(`VerificationToken ${row.token}`, e)
      }
    }

    const stores = await localDb.store.findMany()
    for (const row of stores) {
      try {
        const data = storePayload(row)
        await prodDb.store.upsert({
          where: { id: row.id },
          create: data,
          update: data,
        })
        counts.stores++
      } catch (e) {
        logErr(`Store ${row.id}`, e)
      }
    }

    const products = await localDb.product.findMany()
    for (const row of products) {
      try {
        const data = productPayload(row)
        await prodDb.product.upsert({
          where: { id: row.id },
          create: data,
          update: data,
        })
        counts.products++
      } catch (e) {
        logErr(`Product ${row.id}`, e)
      }
    }

    const affiliateProducts = await localDb.affiliateProduct.findMany()
    for (const row of affiliateProducts) {
      try {
        await prodDb.affiliateProduct.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        })
        counts.affiliateProducts++
      } catch (e) {
        logErr(`AffiliateProduct ${row.id}`, e)
      }
    }

    const carts = await localDb.cart.findMany()
    for (const row of carts) {
      try {
        await prodDb.cart.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        })
        counts.carts++
      } catch (e) {
        logErr(`Cart ${row.id}`, e)
      }
    }

    const cartItems = await localDb.cartItem.findMany()
    for (const row of cartItems) {
      try {
        await prodDb.cartItem.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        })
        counts.cartItems++
      } catch (e) {
        logErr(`CartItem ${row.id}`, e)
      }
    }

    const posts = await localDb.communityPost.findMany()
    for (const row of posts) {
      try {
        await prodDb.communityPost.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        })
        counts.communityPosts++
      } catch (e) {
        logErr(`CommunityPost ${row.id}`, e)
      }
    }

    const follows = await localDb.follow.findMany()
    for (const row of follows) {
      try {
        await prodDb.follow.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        })
        counts.follows++
      } catch (e) {
        logErr(`Follow ${row.id}`, e)
      }
    }

    const orders = await localDb.order.findMany()
    for (const row of orders) {
      try {
        const data = orderPayload(row)
        await prodDb.order.upsert({
          where: { id: row.id },
          create: data,
          update: data,
        })
        counts.orders++
      } catch (e) {
        logErr(`Order ${row.id}`, e)
      }
    }

    const notifications = await localDb.notification.findMany()
    for (const row of notifications) {
      try {
        await prodDb.notification.upsert({
          where: { id: row.id },
          create: row,
          update: row,
        })
        counts.notifications++
      } catch (e) {
        logErr(`Notification ${row.id}`, e)
      }
    }

    console.log("\nDone. Upserted:")
    console.log(
      `  Users: ${counts.users}, Accounts: ${counts.accounts}, Sessions: ${counts.sessions}, VerificationTokens: ${counts.verificationTokens}`,
    )
    console.log(
      `  Stores: ${counts.stores}, Products: ${counts.products}, AffiliateProducts: ${counts.affiliateProducts}`,
    )
    console.log(
      `  Carts: ${counts.carts}, CartItems: ${counts.cartItems}, CommunityPosts: ${counts.communityPosts}, Follows: ${counts.follows}`,
    )
    console.log(`  Orders: ${counts.orders}, Notifications: ${counts.notifications}`)

    if (errors.length) {
      console.log(`\nCompleted with ${errors.length} row-level error(s). Review logs above.`)
      process.exitCode = 1
    } else {
      console.log("\nNo row-level errors.")
    }
  } catch (e) {
    console.error("Fatal error:", e)
    process.exitCode = 1
  } finally {
    await localDb.$disconnect().catch(() => {})
    await prodDb.$disconnect().catch(() => {})
  }
}

void main()
