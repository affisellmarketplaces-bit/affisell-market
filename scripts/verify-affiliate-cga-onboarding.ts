/**
 * Valide onboarding AFFILIATE + acceptation CGA v1.0.0 (gate V2).
 *   npx tsx scripts/verify-affiliate-cga-onboarding.ts
 *   npx tsx scripts/verify-affiliate-cga-onboarding.ts --accept
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const EMAIL = "affiliate-test@affisell.com"
const PASSWORD = "AffiliateTest!2026"
const EXPECTED_HASH =
  "bf914462fecc08479b9b677ba7b96c73f3b547113b730afee2d648a15fc399fd"
const EXPECTED_VERSION_ID = "cmrdpn2ho001hthnpcbpxfqay"

const prisma = new PrismaClient()

async function getCurrentVersionId(slug: string): Promise<string | null> {
  const doc = await prisma.legalDocument.findUnique({
    where: { slug },
    select: { currentVersionId: true },
  })
  return doc?.currentVersionId ?? null
}

async function queryAffiliateAcceptance() {
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
SELECT u.email, u.role, d.slug, lv.version, lv."contentHash", la.context, la."acceptedAt"
FROM "LegalAcceptance" la
JOIN "LegalVersion" lv ON la."documentVersionId" = lv.id
JOIN "LegalDocument" d ON lv."documentId" = d.id
JOIN "User" u ON la."userId" = u.id
WHERE u.email = ${EMAIL} AND d.slug = 'affiliate'
ORDER BY la."acceptedAt" DESC
`
}

async function findMissingSlug(userId: string, role: string): Promise<string | null> {
  const slugs = ["customer", "privacy", ...(role === "AFFILIATE" ? ["affiliate"] : [])]
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

  const affiliateVersion = await prisma.legalVersion.findUnique({
    where: { id: EXPECTED_VERSION_ID },
    select: { id: true, contentHash: true, version: true },
  })
  console.log("[affiliate-cga-test]", { affiliateCurrent: affiliateVersion })

  let user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, email: true, role: true, termsAcceptedVersion: true },
  })

  if (!user) {
    const hash = await bcrypt.hash(PASSWORD, 10)
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        password: hash,
        role: "AFFILIATE",
        name: "Affiliate Test CGA",
        cguAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        termsAcceptedAt: null,
        termsAcceptedVersion: null,
      },
      select: { id: true, email: true, role: true, termsAcceptedVersion: true },
    })
    console.log("[affiliate-cga-test]", { created: user.email, password: PASSWORD })

    for (const slug of ["customer", "privacy"] as const) {
      const versionId = await getCurrentVersionId(slug)
      if (!versionId) continue
      await prisma.legalAcceptance.create({
        data: {
          userId: user.id,
          documentVersionId: versionId,
          ip: "127.0.0.1",
          userAgent: "verify-affiliate-cga-onboarding",
          context: "SIGNUP",
          idempotencyKey: `user:${user.id}:${slug}:signup-test`,
        },
      })
    }
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "AFFILIATE" },
    })
    await prisma.legalAcceptance.deleteMany({
      where: {
        userId: user.id,
        documentVersion: { document: { slug: "affiliate" } },
      },
    })
    console.log("[affiliate-cga-test]", { existing: user.email, affiliateAcceptanceCleared: true })
  }

  const missing = await findMissingSlug(user.id, "AFFILIATE")
  const gateRedirect = missing
    ? `/reaccept-terms?doc=${missing}&returnTo=${encodeURIComponent("/dashboard/affiliate")}`
    : null

  console.log("[affiliate-cga-test]", {
    email: user.email,
    role: user.role,
    missingDocument: missing,
    expectedRedirectAfterSignup: gateRedirect,
    signupUrl: "http://localhost:3001/signup/affiliate",
    note: "Signup → /affiliate/onboarding (exempt gate) ; 1er accès /dashboard/affiliate gated → reaccept-terms?doc=affiliate",
  })

  const rowsBefore = await queryAffiliateAcceptance()
  console.log("[affiliate-cga-test]", { acceptancesBefore: rowsBefore })

  if (doAccept && missing === "affiliate" && affiliateVersion) {
    await prisma.legalAcceptance.create({
      data: {
        userId: user.id,
        documentVersionId: affiliateVersion.id,
        ip: "127.0.0.1",
        userAgent: "reaccept-legal-form",
        context: "REACCEPT_MODAL",
        idempotencyKey: `user:${user.id}:affiliate:${affiliateVersion.version}`,
      },
    })
    await prisma.user.update({
      where: { id: user.id },
      data: {
        termsAcceptedAt: new Date(),
        termsAcceptedVersion: `conditions-affilie:${affiliateVersion.version}`,
      },
    })
    console.log("[affiliate-cga-test]", { accept: "affiliate CGA recorded" })
  }

  const rowsAfter = await queryAffiliateAcceptance()
  const ok =
    rowsAfter.some(
      (r) => r.contentHash === EXPECTED_HASH && r.context === "REACCEPT_MODAL"
    )
  console.log("[affiliate-cga-test]", { acceptancesAfter: rowsAfter, hashAndContextOk: ok })

  if (!ok && !doAccept) {
    console.log("[affiliate-cga-test]", {
      hint: "Relancer avec --accept pour simuler submit /reaccept-terms",
    })
  }
}

main()
  .catch((err) => {
    console.error("[affiliate-cga-test]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
