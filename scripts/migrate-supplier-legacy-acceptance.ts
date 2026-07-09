/**
 * Migre les fournisseurs legacy (termsAcceptedVersion conditions-fournisseur:*)
 * vers LegalAcceptance LMS supplier v courante — idempotent.
 *
 *   npx tsx scripts/migrate-supplier-legacy-acceptance.ts
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import { LegalAcceptanceContext, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type MigrationStats = {
  suppliersScanned: number
  alreadyOnLms: number
  migrated: number
  skippedNoVersion: number
}

async function hasSupplierLegalAcceptance(userId: string): Promise<boolean> {
  const count = await prisma.legalAcceptance.count({
    where: {
      userId,
      documentVersion: { document: { slug: "supplier" } },
    },
  })
  return count > 0
}

async function resolveCurrentSupplierVersionId(): Promise<string | null> {
  const doc = await prisma.legalDocument.findUnique({
    where: { slug: "supplier" },
    select: { currentVersionId: true },
  })
  return doc?.currentVersionId ?? null
}

export async function migrateSupplierLegacyAcceptance(
  db: PrismaClient = prisma
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    suppliersScanned: 0,
    alreadyOnLms: 0,
    migrated: 0,
    skippedNoVersion: 0,
  }

  const supplierVersionId = await resolveCurrentSupplierVersionId()
  if (!supplierVersionId) {
    console.log("[migrate-supplier-legacy]", { result: "no_supplier_version" })
    return stats
  }

  const suppliers = await db.user.findMany({
    where: {
      role: "SUPPLIER",
      termsAcceptedVersion: { startsWith: "conditions-fournisseur:" },
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      termsAcceptedVersion: true,
    },
    orderBy: { createdAt: "asc" },
  })

  stats.suppliersScanned = suppliers.length

  for (const user of suppliers) {
    if (await hasSupplierLegalAcceptance(user.id)) {
      stats.alreadyOnLms += 1
      continue
    }

    const idempotencyKey = `legacy-migrate:supplier:${user.id}`

    try {
      await db.legalAcceptance.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          userId: user.id,
          documentVersionId: supplierVersionId,
          context: LegalAcceptanceContext.MIGRATION_LEGACY,
          acceptedAt: user.createdAt,
          ip: "0.0.0.0",
          userAgent: "legacy-migration",
          idempotencyKey,
        },
      })
      stats.migrated += 1
      console.log("[migrate-supplier-legacy]", {
        userId: user.id,
        email: user.email,
        termsAcceptedVersion: user.termsAcceptedVersion,
        documentVersionId: supplierVersionId,
        result: "migrated",
      })
    } catch (err) {
      console.error("[migrate-supplier-legacy]", {
        userId: user.id,
        email: user.email,
        error: err instanceof Error ? err.message : String(err),
      })
      stats.skippedNoVersion += 1
    }
  }

  return stats
}

async function main() {
  const version = await prisma.legalVersion.findUnique({
    where: { id: (await resolveCurrentSupplierVersionId()) ?? "" },
    select: { version: true, contentHash: true },
  })

  console.log("[migrate-supplier-legacy]", { supplierCurrent: version })

  const stats = await migrateSupplierLegacyAcceptance()

  console.log("[migrate-supplier-legacy]", {
    suppliersScanned: stats.suppliersScanned,
    alreadyOnLms: stats.alreadyOnLms,
    migrated: stats.migrated,
    skippedNoVersion: stats.skippedNoVersion,
    result: "done",
  })
}

main()
  .catch((err) => {
    console.error("[migrate-supplier-legacy]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
