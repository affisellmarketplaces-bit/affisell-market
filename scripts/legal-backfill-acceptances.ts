/**
 * Idempotent backfill User.* consent fields → LegalAcceptance.
 *
 *   npm run legal:backfill:acceptances
 */

import { config } from "dotenv"
import { LegalAcceptanceContext, PrismaClient } from "@prisma/client"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

type BackfillDb = Pick<PrismaClient, "user" | "legalAcceptance" | "legalDocument">

type BackfillStats = {
  usersScanned: number
  acceptancesCreated: number
}

async function resolveFrCurrentVersionId(db: BackfillDb, slug: string): Promise<string | null> {
  const doc = await db.legalDocument.findUnique({
    where: { slug },
    select: { currentVersionId: true },
  })
  return doc?.currentVersionId ?? null
}

function roleSlugFromTermsVersion(
  termsAcceptedVersion: string | null | undefined
): "supplier" | "affiliate" | null {
  if (!termsAcceptedVersion?.trim()) return null
  if (termsAcceptedVersion.startsWith("conditions-fournisseur:")) return "supplier"
  if (termsAcceptedVersion.startsWith("conditions-affilie:")) return "affiliate"
  return null
}

async function upsertMigrationAcceptance(
  db: BackfillDb,
  args: {
    userId: string
    slug: string
    acceptedAt: Date
    idempotencyKey: string
  }
): Promise<boolean> {
  const versionId = await resolveFrCurrentVersionId(db, args.slug)
  if (!versionId) {
    console.log("[legal:backfill]", { slug: args.slug, userId: args.userId, result: "no_version" })
    return false
  }

  await db.legalAcceptance.upsert({
    where: { idempotencyKey: args.idempotencyKey },
    update: {},
    create: {
      userId: args.userId,
      documentVersionId: versionId,
      acceptedAt: args.acceptedAt,
      ip: "0.0.0.0",
      userAgent: "migration:phase2.3",
      context: LegalAcceptanceContext.MIGRATION_BACKFILL,
      idempotencyKey: args.idempotencyKey,
    },
  })

  return true
}

export async function backfillLegalAcceptances(db: BackfillDb = prisma): Promise<BackfillStats> {
  const stats: BackfillStats = { usersScanned: 0, acceptancesCreated: 0 }

  const users = await db.user.findMany({
    where: {
      OR: [
        { cguAcceptedAt: { not: null } },
        { privacyAcceptedAt: { not: null } },
        { termsAcceptedAt: { not: null } },
      ],
    },
    select: {
      id: true,
      cguAcceptedAt: true,
      privacyAcceptedAt: true,
      termsAcceptedAt: true,
      termsAcceptedVersion: true,
    },
  })

  stats.usersScanned = users.length

  for (const user of users) {
    let userTouched = false

    if (user.cguAcceptedAt) {
      const created = await upsertMigrationAcceptance(db, {
        userId: user.id,
        slug: "customer",
        acceptedAt: user.cguAcceptedAt,
        idempotencyKey: `migrate:cgu:${user.id}`,
      })
      if (created) {
        stats.acceptancesCreated += 1
        userTouched = true
      }
    }

    if (user.privacyAcceptedAt) {
      const created = await upsertMigrationAcceptance(db, {
        userId: user.id,
        slug: "privacy",
        acceptedAt: user.privacyAcceptedAt,
        idempotencyKey: `migrate:privacy:${user.id}`,
      })
      if (created) {
        stats.acceptancesCreated += 1
        userTouched = true
      }
    }

    const roleSlug = roleSlugFromTermsVersion(user.termsAcceptedVersion)
    if (user.termsAcceptedAt && roleSlug) {
      const created = await upsertMigrationAcceptance(db, {
        userId: user.id,
        slug: roleSlug,
        acceptedAt: user.termsAcceptedAt,
        idempotencyKey: `migrate:${roleSlug}:${user.id}`,
      })
      if (created) {
        stats.acceptancesCreated += 1
        userTouched = true
      }
    }

    if (userTouched) {
      console.log("[legal:backfill]", { userId: user.id, result: "ok" })
    }
  }

  return stats
}

async function main() {
  const stats = await backfillLegalAcceptances()
  console.log(
    `[legal:backfill] Backfilled ${stats.usersScanned} users (${stats.acceptancesCreated} acceptances upserted)`
  )
}

main()
  .catch((err) => {
    console.error("[legal:backfill]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
