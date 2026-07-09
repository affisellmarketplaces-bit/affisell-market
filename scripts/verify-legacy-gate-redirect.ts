/**
 * Legacy user (User.* consent fields set, zero LegalAcceptance) → gate blocks.
 *   npx tsx scripts/verify-legacy-gate-redirect.ts
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const EMAIL = "gate-legacy@affisell.com"

async function getCurrentVersionId(slug: string): Promise<string | null> {
  const doc = await prisma.legalDocument.findUnique({
    where: { slug },
    select: { currentVersionId: true },
  })
  return doc?.currentVersionId ?? null
}

async function findFirstMissingDocumentSlug(
  userId: string,
  role: string
): Promise<string | null> {
  const slugs = [
    "customer",
    "privacy",
    ...(role === "SUPPLIER" ? ["supplier"] : []),
    ...(role === "AFFILIATE" ? ["affiliate"] : []),
  ]
  for (const slug of slugs) {
    const versionId = await getCurrentVersionId(slug)
    if (!versionId) continue
    const count = await prisma.legalAcceptance.count({
      where: { userId, documentVersionId: versionId },
    })
    if (count === 0) return slug
  }
  return null
}

async function main() {
  const password = await bcrypt.hash("LegacyGate!2026", 10)
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      password,
      role: "CUSTOMER",
      name: "Legacy Gate Test",
      cguAcceptedAt: new Date("2020-01-01"),
      cguVersion: "2026-06-04",
      privacyAcceptedAt: new Date("2020-01-01"),
      privacyAcceptedVersion: "legacy:privacy",
    },
    update: {
      cguAcceptedAt: new Date("2020-01-01"),
      privacyAcceptedAt: new Date("2020-01-01"),
      privacyAcceptedVersion: "legacy:privacy",
    },
  })

  await prisma.legalAcceptance.deleteMany({ where: { userId: user.id } })

  const missing = await findFirstMissingDocumentSlug(user.id, "CUSTOMER")
  const redirect = missing
    ? `/reaccept-terms?returnTo=${encodeURIComponent("/dashboard")}&doc=${missing}`
    : null

  const pass =
    missing === "customer" &&
    redirect !== null &&
    redirect.includes("/reaccept-terms") &&
    redirect.includes("doc=customer")

  console.log("[verify-legacy-gate-redirect]", {
    email: EMAIL,
    password: "LegacyGate!2026",
    lmsRows: 0,
    missingDocument: missing,
    redirect,
    pass,
  })

  if (!pass) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error("[verify-legacy-gate-redirect]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
