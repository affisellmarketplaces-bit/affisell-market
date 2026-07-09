/**
 * Valide gate Privacy v1.0.0 — redirect reaccept + trace LMS.
 *   npx tsx scripts/verify-privacy-gate.ts
 *   npx tsx scripts/verify-privacy-gate.ts --accept
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const EMAIL = "privacy-test@affisell.com"
const PASSWORD = "PrivacyTest!2026"
const EXPECTED_HASH =
  "78d004c56b707d210ce3f45b87c26d9c083566aa7f9052dec4ad919ea0b5ff16"
const EXPECTED_VERSION_ID = "cmrdpn4ni001ythnpiudey0jm"

const prisma = new PrismaClient()

async function getCurrentVersionId(slug: string): Promise<string | null> {
  const doc = await prisma.legalDocument.findUnique({
    where: { slug },
    select: { currentVersionId: true },
  })
  return doc?.currentVersionId ?? null
}

async function queryPrivacyAcceptance(userId: string) {
  return prisma.$queryRaw<
    Array<{
      slug: string
      contentHash: string
      version: string
      context: string
      acceptedAt: Date
    }>
  >`
SELECT d.slug, lv."contentHash", lv.version, la.context, la."acceptedAt"
FROM "LegalAcceptance" la
JOIN "LegalVersion" lv ON la."documentVersionId" = lv.id
JOIN "LegalDocument" d ON lv."documentId" = d.id
WHERE la."userId" = ${userId} AND d.slug = 'privacy'
ORDER BY la."acceptedAt" DESC
`
}

async function findMissingSlug(userId: string, role: string): Promise<string | null> {
  const slugs = ["customer", "privacy"]
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
  const doAccept = process.argv.includes("--accept")

  const privacyVersion = await prisma.legalVersion.findUnique({
    where: { id: EXPECTED_VERSION_ID },
    select: { id: true, contentHash: true, version: true },
  })
  console.log("[privacy-gate-test]", { privacyCurrent: privacyVersion })

  let user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, email: true, role: true, privacyAcceptedAt: true },
  })

  const customerVersionId = await getCurrentVersionId("customer")

  if (!user) {
    const hash = await bcrypt.hash(PASSWORD, 10)
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        password: hash,
        role: "CUSTOMER",
        name: "Privacy Gate Test",
        cguAcceptedAt: new Date(),
        privacyAcceptedAt: null,
        privacyAcceptedVersion: null,
      },
      select: { id: true, email: true, role: true, privacyAcceptedAt: true },
    })
    console.log("[privacy-gate-test]", { created: user.email, password: PASSWORD })
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: "CUSTOMER",
        privacyAcceptedAt: null,
        privacyAcceptedVersion: null,
      },
    })
    await prisma.legalAcceptance.deleteMany({
      where: {
        userId: user.id,
        documentVersion: { document: { slug: "privacy" } },
      },
    })
    console.log("[privacy-gate-test]", { existing: user.email, privacyAcceptanceCleared: true })
  }

  if (customerVersionId) {
    await prisma.legalAcceptance.upsert({
      where: { idempotencyKey: `user:${user.id}:customer:signup-test` },
      update: {},
      create: {
        userId: user.id,
        documentVersionId: customerVersionId,
        ip: "127.0.0.1",
        userAgent: "verify-privacy-gate",
        context: "SIGNUP",
        idempotencyKey: `user:${user.id}:customer:signup-test`,
      },
    })
  }

  const missing = await findMissingSlug(user.id, "CUSTOMER")
  const gateRedirect = missing
    ? `/reaccept-terms?doc=${missing}&returnTo=${encodeURIComponent("/dashboard")}`
    : null

  console.log("[privacy-gate-test]", {
    userId: user.id,
    email: user.email,
    missingDocument: missing,
    expectedRedirect: gateRedirect,
    loginUrl: "http://localhost:3001/login",
    note: "Login → 1er accès /dashboard ou /marketplace gated → reaccept-terms?doc=privacy",
  })

  const rowsBefore = await queryPrivacyAcceptance(user.id)
  console.log("[privacy-gate-test]", { acceptancesBefore: rowsBefore })

  if (doAccept && missing === "privacy" && privacyVersion) {
    await prisma.legalAcceptance.create({
      data: {
        userId: user.id,
        documentVersionId: privacyVersion.id,
        ip: "127.0.0.1",
        userAgent: "reaccept-legal-form",
        context: "REACCEPT_MODAL",
        idempotencyKey: `user:${user.id}:privacy:${privacyVersion.version}`,
      },
    })
    await prisma.user.update({
      where: { id: user.id },
      data: {
        privacyAcceptedAt: new Date(),
        privacyAcceptedVersion: `privacy-policy:1.0.0`,
      },
    })
    console.log("[privacy-gate-test]", { accept: "privacy v1.0.0 recorded" })
  }

  const rowsAfter = await queryPrivacyAcceptance(user.id)
  const ok = rowsAfter.some((r) => r.contentHash === EXPECTED_HASH)
  console.log("[privacy-gate-test]", { acceptancesAfter: rowsAfter, hashOk: ok })
}

main()
  .catch((err) => {
    console.error("[privacy-gate-test]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
