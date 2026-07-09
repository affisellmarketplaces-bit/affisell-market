import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

const prisma = new PrismaClient()
const ACCEPT = process.argv.includes("--accept")

const REQUIRED_DOCS_BY_ROLE = {
  CUSTOMER: ["customer", "privacy", "terms-of-sale"],
  SUPPLIER: ["customer", "privacy", "supplier"],
  AFFILIATE: ["customer", "privacy", "affiliate"],
} as const

const TEST_USERS = [
  { email: "gate-customer@affisell.com", role: "CUSTOMER" as const },
  { email: "gate-supplier@affisell.com", role: "SUPPLIER" as const },
  { email: "gate-affiliate@affisell.com", role: "AFFILIATE" as const },
]

const EXPECTED_HASHES = {
  customer: "fb236ee2c5db695aa246bc51cf60d4d2cb2bf409f6513e89dfe3c742c6b1bbfb",
  privacy: "78d004c56b707d210ce3f45b87c26d9c083566aa7f9052dec4ad919ea0b5ff16",
  supplier: "0dab6258c7b17195a0253541f4c5bbdf593d0a3d4a1b9925e5dade6c1d18c150",
  affiliate: "1e0448f732ec78bd6cfb300057d2f276d6e2b18c78af0f68c8fbbc47bbaae90b",
  "terms-of-sale": "652b0e845c7153c225e95cdfb0532de95a4026607b3ff382a4803fca150e43b4",
}

async function main() {
  console.log("[verify-gate-all-roles] Start")

  const results = []

  for (const testUser of TEST_USERS) {
    console.log(`\n=== ${testUser.role} ===`)

    let user = await prisma.user.findUnique({ where: { email: testUser.email } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: testUser.email,
          password: await hashPassword("Test!2026"),
          role: testUser.role,
          name: `Gate Test ${testUser.role}`,
        },
      })
      console.log(`Created user: ${user.email}`)
    }

    const acceptances = await prisma.legalAcceptance.findMany({
      where: { userId: user.id },
      include: { documentVersion: { include: { document: true } } },
    })

    const acceptedSlugs = acceptances.map((a) => a.documentVersion.document.slug)
    const requiredDocs = REQUIRED_DOCS_BY_ROLE[testUser.role]
    const missingDocs = requiredDocs.filter((doc) => !acceptedSlugs.includes(doc))

    console.log(`Required: ${requiredDocs.join(", ")}`)
    console.log(`Accepted: ${acceptedSlugs.join(", ") || "none"}`)
    console.log(`Missing: ${missingDocs.join(", ") || "none"}`)

    if (ACCEPT && missingDocs.length > 0) {
      for (const docSlug of missingDocs) {
        const doc = await prisma.legalDocument.findUnique({
          where: { slug: docSlug },
          include: { currentVersion: true },
        })

        if (!doc?.currentVersion) {
          console.error(`❌ No version found for ${docSlug}`)
          continue
        }

        await prisma.legalAcceptance.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            documentVersionId: doc.currentVersion.id,
            context: "REACCEPT_MODAL",
            ip: "127.0.0.1",
            userAgent: "verify-gate-script",
          },
        })
        console.log(`✅ Accepted ${docSlug} v${doc.currentVersion.version}`)
      }
    }

    const finalAcceptances = await prisma.legalAcceptance.findMany({
      where: { userId: user.id },
      include: { documentVersion: { include: { document: true } } },
    })

    const report = {
      email: user.email,
      role: user.role,
      gatePass: requiredDocs.every((doc) =>
        finalAcceptances.some((a) => a.documentVersion.document.slug === doc)
      ),
      docs: finalAcceptances.map((a) => ({
        slug: a.documentVersion.document.slug,
        version: a.documentVersion.version,
        contentHash: a.documentVersion.contentHash,
        context: a.context,
        hashOk:
          a.documentVersion.contentHash ===
          EXPECTED_HASHES[a.documentVersion.document.slug as keyof typeof EXPECTED_HASHES],
      })),
    }

    results.push(report)
    console.log(`Gate: ${report.gatePass ? "✅ PASS" : "❌ BLOCKED"}`)
  }

  console.log("\n=== SUMMARY ===")
  console.table(
    results.map((r) => ({
      email: r.email,
      role: r.role,
      gatePass: r.gatePass,
      docsCount: r.docs.length,
      allHashesOk: r.docs.every((d) => d.hashOk),
    }))
  )

  const allPass = results.every((r) => r.gatePass && r.docs.every((d) => d.hashOk))
  console.log(
    `\n[verify-gate-all-roles] ${allPass ? "✅ ALL GATES PASS" : "❌ FAILURES DETECTED"}`
  )

  await prisma.$disconnect()
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
