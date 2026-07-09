/**
 * Valide onboarding SUPPLIER + acceptation CGS v1.0.0 (post-KYC gate).
 *   npx tsx scripts/verify-supplier-cgs-onboarding.ts
 *   npx tsx scripts/verify-supplier-cgs-onboarding.ts --accept
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const EMAIL = "supplier-test@affisell.com"
const PASSWORD = "SupplierTest!2026"
const EXPECTED_HASH =
  "0dab6258c7b17195a0253541f4c5bbdf593d0a3d4a1b9925e5dade6c1d18c150"
const EXPECTED_VERSION_ID = "cmrdpn0a70010thnpp4qygk98"

const prisma = new PrismaClient()

async function getCurrentVersionId(slug: string): Promise<string | null> {
  const doc = await prisma.legalDocument.findUnique({
    where: { slug },
    select: { currentVersionId: true },
  })
  return doc?.currentVersionId ?? null
}

async function querySupplierAcceptance() {
  return prisma.$queryRaw<
    Array<{
      email: string
      role: string
      slug: string
      version: string
      contentHash: string
      acceptedAt: Date
      context: string
    }>
  >`
SELECT u.email, u.role, d.slug, lv.version, lv."contentHash", la."acceptedAt", la.context
FROM "LegalAcceptance" la
JOIN "LegalVersion" lv ON la."documentVersionId" = lv.id
JOIN "LegalDocument" d ON lv."documentId" = d.id
JOIN "User" u ON la."userId" = u.id
WHERE u.email = ${EMAIL} AND d.slug = 'supplier'
ORDER BY la."acceptedAt" DESC
`
}

async function findMissingSlug(userId: string, role: string): Promise<string | null> {
  const slugs = ["customer", "privacy", ...(role === "SUPPLIER" ? ["supplier"] : [])]
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

  const supplierVersion = await prisma.legalVersion.findUnique({
    where: { id: EXPECTED_VERSION_ID },
    select: { id: true, contentHash: true, version: true },
  })
  console.log("[supplier-cgs-test]", { supplierCurrent: supplierVersion })

  let user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, email: true, role: true, stripeOnboardedAt: true },
  })

  if (!user) {
    const hash = await bcrypt.hash(PASSWORD, 10)
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        password: hash,
        role: "SUPPLIER",
        name: "Supplier Test CGS",
        stripeOnboardedAt: new Date(),
        cguAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        termsAcceptedAt: null,
      },
      select: { id: true, email: true, role: true, stripeOnboardedAt: true },
    })
    console.log("[supplier-cgs-test]", { created: user.email, password: PASSWORD })

    for (const slug of ["customer", "privacy"] as const) {
      const versionId = await getCurrentVersionId(slug)
      if (!versionId) continue
      await prisma.legalAcceptance.create({
        data: {
          userId: user.id,
          documentVersionId: versionId,
          ip: "127.0.0.1",
          userAgent: "verify-supplier-cgs-onboarding",
          context: "SIGNUP",
          idempotencyKey: `user:${user.id}:${slug}:signup-test`,
        },
      })
    }
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "SUPPLIER", stripeOnboardedAt: user.stripeOnboardedAt ?? new Date() },
    })
    // Reset supplier acceptance to simulate post-KYC gate
    await prisma.legalAcceptance.deleteMany({
      where: {
        userId: user.id,
        documentVersion: { document: { slug: "supplier" } },
      },
    })
    console.log("[supplier-cgs-test]", { existing: user.email, supplierAcceptanceCleared: true })
  }

  const missing = await findMissingSlug(user.id, "SUPPLIER")
  const gateRedirect = missing
    ? `/reaccept-terms?doc=${missing}&returnTo=${encodeURIComponent("/dashboard/supplier/balance")}`
    : null

  console.log("[supplier-cgs-test]", {
    email: user.email,
    role: user.role,
    stripeOnboardedAt: user.stripeOnboardedAt,
    missingDocument: missing,
    expectedRedirectAfterKyc: gateRedirect,
    signupUrl: "http://localhost:3001/signup/supplier",
    note: "Après Stripe return_url → /dashboard/supplier/balance → gate V2 → reaccept-terms?doc=supplier",
  })

  const rowsBefore = await querySupplierAcceptance()
  console.log("[supplier-cgs-test]", { acceptancesBefore: rowsBefore })

  if (doAccept && missing === "supplier" && supplierVersion) {
    await prisma.legalAcceptance.create({
      data: {
        userId: user.id,
        documentVersionId: supplierVersion.id,
        ip: "127.0.0.1",
        userAgent: "reaccept-legal-form",
        context: "REACCEPT_MODAL",
        idempotencyKey: `user:${user.id}:supplier:${supplierVersion.version}`,
      },
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { termsAcceptedAt: new Date() },
    })
    console.log("[supplier-cgs-test]", { accept: "supplier CGS recorded" })
  }

  const rowsAfter = await querySupplierAcceptance()
  const ok = rowsAfter.some((r) => r.contentHash === EXPECTED_HASH)
  console.log("[supplier-cgs-test]", { acceptancesAfter: rowsAfter, hashOk: ok })

  if (!ok && !doAccept) {
    console.log("[supplier-cgs-test]", {
      hint: "Relancer avec --accept pour simuler submit /reaccept-terms",
    })
  }
}

main()
  .catch((err) => {
    console.error("[supplier-cgs-test]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
