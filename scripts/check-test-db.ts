/**
 * Preflight for `npm run test:db` — read-only. Explains why DB tests cannot run instead of failing obscurely.
 *   npm run test:db:check
 */
import fs from "node:fs"
import path from "node:path"

import { PrismaClient } from "@prisma/client"

import { assessTestDatabaseUrl, readEnvFile, pointAtTestDatabase } from "../lib/testing/db-test-guard"

function fail(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

async function main() {
  const root = process.cwd()
  const envFile = path.join(root, ".env.test.local")
  if (!fs.existsSync(envFile)) {
    fail(
      ".env.test.local not found.\n  1. Neon console → Branches → Create branch (from your main branch)\n  2. cp .env.test.local.example .env.test.local and paste the BRANCH connection string as DATABASE_URL_TEST"
    )
  }
  const raw = readEnvFile(envFile).DATABASE_URL_TEST
  const shape = assessTestDatabaseUrl(raw, [])
  if (!shape.ok) fail(shape.reason)

  let endpoint: string
  try {
    endpoint = pointAtTestDatabase(root) // throws if it matches DATABASE_URL / DIRECT_URL / STAGING / …
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
  }
  console.log(`✓ test database endpoint: ${endpoint} (distinct from every protected URL)`)

  const prisma = new PrismaClient()
  try {
    await prisma.$queryRawUnsafe("select 1")
    console.log("✓ connection OK")

    const applied = (await prisma.$queryRawUnsafe(
      'select count(*)::int as n from "_prisma_migrations" where finished_at is not null'
    )) as Array<{ n: number }>
    const local = fs
      .readdirSync(path.join(root, "prisma", "migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory()).length
    const n = applied[0]?.n ?? 0
    if (n < local) fail(`schema is behind: ${n}/${local} migrations applied. Run: DATABASE_URL="<branch url>" npx prisma migrate deploy`)
    console.log(`✓ schema up to date (${n}/${local} migrations)`)

    const [users, orders] = await Promise.all([prisma.user.count(), prisma.order.count()])
    console.log(`✓ contents: ${users} users, ${orders} orders (the tests only create and delete their own rows)`)
    console.log("\nReady. Run: npm run test:db")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
