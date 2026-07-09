/**
 * Ensure SUPPLIER users have LMS supplier acceptance on current version — idempotent.
 *
 *   npx tsx scripts/migrate-supplier-legacy-acceptance.ts
 *   npx tsx scripts/migrate-supplier-legacy-acceptance.ts --email=julishop100k@gmail.com
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import { LegalAcceptanceContext, PrismaClient } from "@prisma/client"

const EXPECTED_SUPPLIER_HASH =
  "0dab6258c7b17195a0253541f4c5bbdf593d0a3d4a1b9925e5dade6c1d18c150"

const prisma = new PrismaClient()

type MigrationStats = {
  suppliersScanned: number
  alreadyOnLms: number
  migrated: number
  skippedNoVersion: number
}

export type MigrateSupplierLegacyOptions = {
  email?: string
}

async function hasSupplierLegalAcceptance(userId: string, db: PrismaClient): Promise<boolean> {
  const count = await db.legalAcceptance.count({
    where: {
      userId,
      documentVersion: { document: { slug: "supplier" } },
    },
  })
  return count > 0
}

async function resolveCurrentSupplierVersionId(db: PrismaClient): Promise<string | null> {
  const doc = await db.legalDocument.findUnique({
    where: { slug: "supplier" },
    select: { currentVersionId: true },
  })
  return doc?.currentVersionId ?? null
}

export async function migrateSupplierLegacyAcceptance(
  db: PrismaClient = prisma,
  options: MigrateSupplierLegacyOptions = {}
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    suppliersScanned: 0,
    alreadyOnLms: 0,
    migrated: 0,
    skippedNoVersion: 0,
  }

  const supplierVersionId = await resolveCurrentSupplierVersionId(db)
  if (!supplierVersionId) {
    console.log("[migrate-supplier-legacy]", { result: "no_supplier_version" })
    return stats
  }

  const suppliers = await db.user.findMany({
    where: {
      role: "SUPPLIER",
      ...(options.email ? { email: options.email.toLowerCase().trim() } : {}),
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      termsAcceptedAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  for (const user of suppliers) {
    stats.suppliersScanned += 1

    if (await hasSupplierLegalAcceptance(user.id, db)) {
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
          acceptedAt: user.termsAcceptedAt ?? user.createdAt,
          ip: "0.0.0.0",
          userAgent: "legacy-migration",
          idempotencyKey,
        },
      })
      stats.migrated += 1
      console.log("[migrate-supplier-legacy]", {
        userId: user.id,
        email: user.email,
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

function parseArgs(argv: string[]) {
  const emailArg = argv.find((a) => a.startsWith("--email="))
  const email = emailArg?.slice("--email=".length).trim().toLowerCase() || undefined
  return { email }
}

async function main() {
  const { email } = parseArgs(process.argv)
  const supplierVersionId = await resolveCurrentSupplierVersionId(prisma)
  const version = supplierVersionId
    ? await prisma.legalVersion.findUnique({
        where: { id: supplierVersionId },
        select: { version: true, contentHash: true },
      })
    : null

  console.log("[migrate-supplier-legacy]", {
    supplierCurrent: version,
    email: email ?? "all",
    expectedHash: EXPECTED_SUPPLIER_HASH,
  })

  const stats = await migrateSupplierLegacyAcceptance(prisma, { email })

  console.log("[migrate-supplier-legacy]", {
    suppliersScanned: stats.suppliersScanned,
    alreadyOnLms: stats.alreadyOnLms,
    migrated: stats.migrated,
    skippedNoVersion: stats.skippedNoVersion,
    result: "done",
  })

  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })
    if (user) {
      const rows = await prisma.legalAcceptance.findMany({
        where: {
          userId: user.id,
          documentVersion: { document: { slug: "supplier" } },
        },
        include: {
          documentVersion: { select: { version: true, contentHash: true } },
        },
        orderBy: { acceptedAt: "desc" },
      })
      console.log("[migrate-supplier-legacy]", {
        verify: rows.map((r) => ({
          userId: user.id,
          slug: "supplier",
          version: r.documentVersion.version,
          contentHash: r.documentVersion.contentHash,
          context: r.context,
          acceptedAt: r.acceptedAt,
          hashOk: r.documentVersion.contentHash === EXPECTED_SUPPLIER_HASH,
        })),
      })
    }
  }
}

main()
  .catch((err) => {
    console.error("[migrate-supplier-legacy]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
