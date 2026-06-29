#!/usr/bin/env npx tsx
/**
 * Lightning Payout readiness audit — 12 checks, no production mutations except a transient test order.
 *
 * Run: npx tsx scripts/audit-lightning.ts
 */
import { config } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { resolve } from "node:path"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) config({ path, override: true })
}

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { triggerLightningPayout } from "@/lib/stripe-lightning"

type AuditRow = {
  check: string
  status: "OK" | "KO"
  detail: string
}

const rows: AuditRow[] = []

function push(check: string, ok: boolean, detail: string) {
  rows.push({ check, status: ok ? "OK" : "KO", detail })
}

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function maskSecret(value: string | undefined, prefixLen = 7): string {
  const v = value?.trim() ?? ""
  if (!v) return "(absent)"
  if (v.length <= prefixLen + 3) return `${v.slice(0, 3)}…`
  return `${v.slice(0, prefixLen)}…`
}

function schemaHasField(modelBlock: string, field: string): boolean {
  const re = new RegExp(`^\\s*${field}\\s+`, "m")
  return re.test(modelBlock)
}

function extractModelBlock(schema: string, modelName: string): string {
  const re = new RegExp(`model ${modelName} \\{[\\s\\S]*?^\\}`, "m")
  const match = schema.match(re)
  return match?.[0] ?? ""
}

async function dbColumnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
      AND column_name = ${column}
    LIMIT 1
  `
  return rows.length > 0
}

async function checkPrismaSchemas() {
  const schema = readRepoFile("prisma/schema.prisma")
  const supplierBlock = extractModelBlock(schema, "SupplierProfile")
  const affiliateBlock = extractModelBlock(schema, "AffiliateProfile")
  const orderBlock = extractModelBlock(schema, "Order")

  const supplierFields = ["trustScore", "lightningEnabled", "stripeAccountId"] as const
  const affiliateFields = ["stripeAccountId"] as const
  const orderFields = [
    "shippedAt",
    "trackingNumber",
    "payoutStatus",
    "payoutTransferIds",
  ] as const

  const supplierSchemaOk = supplierFields.every((f) => schemaHasField(supplierBlock, f))
  const affiliateSchemaOk = affiliateFields.every((f) => schemaHasField(affiliateBlock, f))

  let supplierDbOk = true
  let affiliateDbOk = true
  let orderDbOk = true
  const dbErrors: string[] = []

  try {
    for (const field of supplierFields) {
      const col = field === "lightningEnabled" ? "lightningEnabled" : field
      const ok = await dbColumnExists("SupplierProfile", col)
      if (!ok) {
        supplierDbOk = false
        dbErrors.push(`SupplierProfile.${col}`)
      }
    }
    for (const field of affiliateFields) {
      const ok = await dbColumnExists("AffiliateProfile", field)
      if (!ok) {
        affiliateDbOk = false
        dbErrors.push(`AffiliateProfile.${field}`)
      }
    }
    for (const field of orderFields) {
      const ok = await dbColumnExists("Order", field)
      if (!ok) {
        orderDbOk = false
        dbErrors.push(`Order.${field}`)
      }
    }
  } catch (error) {
    supplierDbOk = false
    affiliateDbOk = false
    orderDbOk = false
    dbErrors.push(error instanceof Error ? error.message : String(error))
  }

  const supplierOk = supplierSchemaOk && affiliateSchemaOk && supplierDbOk && affiliateDbOk
  push(
    "DB Schema SupplierProfile",
    supplierOk,
    supplierOk
      ? "trustScore, lightningEnabled, stripeAccountId + AffiliateProfile.stripeAccountId"
      : `schema=${supplierSchemaOk && affiliateSchemaOk}, db=${supplierDbOk && affiliateDbOk}${
          dbErrors.length ? ` — ${dbErrors.join(", ")}` : ""
        }`
  )

  const orderSchemaOk = orderFields.every((f) => schemaHasField(orderBlock, f))
  const orderOk = orderSchemaOk && orderDbOk
  push(
    "DB Schema Order",
    orderOk,
    orderOk
      ? "shippedAt, trackingNumber, payoutStatus, payoutTransferIds"
      : `schema=${orderSchemaOk}, db=${orderDbOk}${
          dbErrors.length ? ` — ${dbErrors.filter((e) => e.startsWith("Order.")).join(", ")}` : ""
        }`
  )
}

function checkCoreFiles() {
  const lightningSrc = readRepoFile("lib/stripe-lightning.ts")
  const trustSrc = readRepoFile("lib/trust-score.ts")
  const exportsOk =
    /export\s+async\s+function\s+triggerLightningPayout/.test(lightningSrc) &&
    /export\s+async\s+function\s+calculateTrustScore/.test(trustSrc)

  push(
    "File lib/stripe-lightning.ts + trust-score",
    exportsOk,
    exportsOk
      ? "triggerLightningPayout + calculateTrustScore exportés"
      : "Export manquant dans lib/stripe-lightning.ts ou lib/trust-score.ts"
  )
}

function checkApiUiFiles() {
  const routePath = "app/api/orders/[id]/mark-shipped/route.ts"
  const routeExists = existsSync(resolve(root, routePath))
  const orderActions = readRepoFile("components/supplier/order-actions.tsx")
  const uiOk = orderActions.includes("Marquer expédié")

  push(
    "File mark-shipped + order-actions",
    routeExists && uiOk,
    routeExists && uiOk
      ? "Route POST mark-shipped + libellé « Marquer expédié »"
      : `${routeExists ? "" : "Route absente"}${!routeExists && !uiOk ? " · " : ""}${
          uiOk ? "" : "UI « Marquer expédié » absente"
        }`.trim()
  )
}

function checkEnvVars() {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  push(
    "Env STRIPE_SECRET_KEY",
    Boolean(stripeKey?.startsWith("sk_")),
    stripeKey?.startsWith("sk_") ? maskSecret(stripeKey) : "Absent ou format invalide (sk_…)"
  )

  const webhookSecret =
    process.env.AFTIRSHIP_WEBHOOK_SECRET?.trim() ||
    process.env.AFTERSHIP_WEBHOOK_SECRET?.trim()
  push(
    "Env AFTIRSHIP_WEBHOOK_SECRET",
    Boolean(webhookSecret),
    webhookSecret
      ? `${process.env.AFTIRSHIP_WEBHOOK_SECRET ? "AFTIRSHIP" : "AFTERSHIP"}=${maskSecret(webhookSecret, 4)}`
      : "AFTIRSHIP_WEBHOOK_SECRET et AFTERSHIP_WEBHOOK_SECRET absents"
  )

  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  push(
    "Env NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    Boolean(publishable?.startsWith("pk_")),
    publishable?.startsWith("pk_") ? maskSecret(publishable) : "Absent ou format invalide (pk_…)"
  )
}

async function checkStripeConnect() {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeKey?.startsWith("sk_")) {
    push("Stripe Connect API", false, "STRIPE_SECRET_KEY manquante — skip accounts.list")
    push("Stripe Connect transfers", false, "STRIPE_SECRET_KEY manquante — skip capabilities")
    return
  }

  try {
    const stripe = getStripeClient()
    await stripe.accounts.list({ limit: 1 })
    push("Stripe Connect API", true, "accounts.list OK — clé API valide")
  } catch (error) {
    push(
      "Stripe Connect API",
      false,
      error instanceof Error ? error.message : String(error)
    )
    push("Stripe Connect transfers", false, "accounts.list a échoué")
    return
  }

  try {
    const stripe = getStripeClient()
    const platformAccountId = process.env.STRIPE_PLATFORM_ACCOUNT_ID?.trim()
    let transfers = false
    let detail = ""

    if (platformAccountId) {
      const platform = await stripe.accounts.retrieve(platformAccountId)
      transfers =
        platform.capabilities?.transfers === "active" ||
        platform.capabilities?.legacy_payments === "active"
      detail = transfers
        ? `capabilities.transfers=${platform.capabilities?.transfers ?? "n/a"}`
        : `transfers=${platform.capabilities?.transfers ?? "inactive"}`
    } else {
      await stripe.transfers.list({ limit: 1 })
      transfers = true
      detail =
        "transfers.list OK (définir STRIPE_PLATFORM_ACCOUNT_ID pour vérifier capabilities)"
    }

    push("Stripe Connect transfers", transfers, detail)
  } catch (error) {
    push(
      "Stripe Connect transfers",
      false,
      error instanceof Error ? error.message : String(error)
    )
  }
}

function checkIdempotencyKey() {
  const src = readRepoFile("lib/stripe-lightning.ts")
  const ok =
    src.includes("lightning_${orderId}") ||
    src.includes("`lightning_${orderId}") ||
    /lightning_\$\{orderId\}/.test(src)
  push(
    "Idempotency Key",
    ok,
    ok
      ? "Pattern lightning_${orderId} trouvé (supplier + affiliate suffix)"
      : "Pattern lightning_${orderId} absent de lib/stripe-lightning.ts"
  )
}

function checkMarkShippedAuth() {
  const src = readRepoFile("app/api/orders/[id]/mark-shipped/route.ts")
  const ok =
    src.includes("session.user.id !== order.supplier.id") ||
    src.includes("session.user.id !== order.supplierId")
  push(
    "Mark-shipped auth supplier",
    ok,
    ok
      ? "session.user.id vérifié contre order.supplier.id"
      : "Auth supplier non trouvée dans mark-shipped/route.ts"
  )
}

async function checkDryRun() {
  const src = readRepoFile("lib/stripe-lightning.ts")
  const supportsDryRun =
    /function\s+triggerLightningPayout\([^)]*dryRun/.test(src) ||
    /dryRun\s*[=:]\s*true/.test(src) ||
    /reason:\s*["']dryRun["']/.test(src)

  if (!supportsDryRun) {
    push(
      "Dry-run triggerLightningPayout",
      false,
      "Option dryRun absente — triggerLightningPayout(orderId) sans mode simulation"
    )
    return
  }

  let testOrderId: string | null = null
  try {
    const anchor = await prisma.affiliateProduct.findFirst({
      where: { product: { active: true } },
      select: {
        id: true,
        productId: true,
        affiliateId: true,
        product: { select: { supplierId: true } },
      },
    })

    if (!anchor?.product?.supplierId) {
      push(
        "Dry-run triggerLightningPayout",
        false,
        "Impossible de créer order test — aucun AffiliateProduct actif"
      )
      return
    }

    testOrderId = `audit_lightning_${randomUUID()}`
    await prisma.order.create({
      data: {
        id: testOrderId,
        productId: anchor.productId,
        affiliateProductId: anchor.id,
        supplierId: anchor.product.supplierId,
        affiliateId: anchor.affiliateId,
        customerEmail: "audit-lightning@affisell.com",
        shippingAddress: { line1: "1 Audit St", city: "Paris", country: "FR" },
        basePriceCents: 1000,
        sellingPriceCents: 1200,
        commissionCents: 100,
        marginCents: 200,
        affiliatePayoutCents: 100,
        supplierPayoutCents: 900,
        stripeSessionId: `audit_cs_${randomUUID()}`,
        payoutStatus: "PENDING",
      },
    })

    const result = await (
      triggerLightningPayout as (
        orderId: string,
        options?: { dryRun?: boolean }
      ) => ReturnType<typeof triggerLightningPayout>
    )(testOrderId, { dryRun: true })

    const ok =
      result.success === false &&
      "reason" in result &&
      result.reason === "dryRun"

    push(
      "Dry-run triggerLightningPayout",
      ok,
      ok
        ? "{ success: false, reason: \"dryRun\" } sans appel Stripe"
        : `Réponse inattendue: ${JSON.stringify(result)}`
    )
  } catch (error) {
    push(
      "Dry-run triggerLightningPayout",
      false,
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    if (testOrderId) {
      await prisma.order.delete({ where: { id: testOrderId } }).catch(() => undefined)
    }
  }
}

function printTable() {
  console.log("\n| Check | Status | Détail |")
  console.log("| --- | --- | --- |")
  for (const row of rows) {
    const icon = row.status === "OK" ? "✅ OK" : "❌ KO"
    const detail = row.detail.replace(/\|/g, "\\|")
    console.log(`| ${row.check} | ${icon} | ${detail} |`)
  }
  console.log("")
}

async function main() {
  console.log("[audit-lightning] Lightning Payout — audit 12 points\n")

  await checkPrismaSchemas()
  checkCoreFiles()
  checkApiUiFiles()
  checkEnvVars()
  await checkStripeConnect()
  checkIdempotencyKey()
  checkMarkShippedAuth()
  await checkDryRun()

  printTable()

  const okCount = rows.filter((r) => r.status === "OK").length
  const total = rows.length
  console.log(`[audit-lightning] Score: ${okCount}/${total}`)

  if (okCount === total) {
    console.log("✅ LIGHTNING READY TO SHIP")
    return
  }

  console.log("❌ BLOQUÉ. Corriger les KO avant prod")
  process.exit(1)
}

main()
  .catch((error) => {
    console.error("[audit-lightning]", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
