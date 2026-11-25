/**
 * Account access operations — reversible, guarded, never printing a hash or a password.
 *
 *   npx tsx scripts/account-access.ts create-admin --email <e-mail>          [--apply]
 *       ADMIN_BOOTSTRAP_PASSWORD (>= 16 chars, not a published value) — creates a nominative ADMIN account.
 *   npx tsx scripts/account-access.ts lock   --emails a@x,b@y --expect 2      [--apply]
 *   npx tsx scripts/account-access.ts unlock --emails a@x      --expect 1      [--apply]
 *
 * Dry run by default (prints the plan). `--apply` runs ONE transaction that re-reads the accounts under row locks and
 * re-checks the plan before writing; the row count must match `--expect` exactly or nothing is written.
 * Lock = the stored bcrypt hash is prefixed with `locked-<date>:` (sign-in refused, open sessions end at the next
 * revalidation — lib/auth-account-lock.ts); unlock removes the prefix. Profiles, legal acceptances and business data are
 * untouched. The last unlocked ADMIN can never be locked.
 * Production needs AFFISELL_ALLOW_PRODUCTION_WRITES=<endpoint> (scripts/lib/production-guard.mjs).
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import bcrypt from "bcryptjs"
import { Prisma, PrismaClient } from "@prisma/client"

import {
  LOCK_PREFIX,
  adminPasswordProblem,
  lockTag,
  planCreateAdmin,
  planLock,
  planUnlock,
} from "./lib/account-access-plan.mjs"
import { assertNotProductionByAccident } from "./lib/production-guard.mjs"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const command = process.argv[2]
const apply = process.argv.includes("--apply")

function fail(msg: string, code = 1): never {
  console.error(`✗ [account-access] ${msg}`)
  process.exit(code)
}

if (!["create-admin", "lock", "unlock"].includes(command ?? "")) {
  fail("usage: create-admin --email <e> | lock --emails <a,b> --expect <n> | unlock --emails <a> --expect <n> [--apply]")
}

assertNotProductionByAccident("scripts/account-access.ts")
const prisma = new PrismaClient()

type Row = { email: string; role: string; hasPassword: boolean; locked: boolean }

async function readRows(tx: Prisma.TransactionClient | PrismaClient, emails: string[], forUpdate: boolean): Promise<Row[]> {
  const lock = forUpdate ? Prisma.sql`FOR UPDATE` : Prisma.empty
  return tx.$queryRaw<Row[]>`
    SELECT lower(email) AS email, role, (password IS NOT NULL) AS "hasPassword",
           coalesce(password LIKE ${LOCK_PREFIX + "%"}, false) AS locked
    FROM "User" WHERE lower(email) IN (${Prisma.join(emails)}) ${lock}`
}

async function unlockedAdmins(tx: Prisma.TransactionClient | PrismaClient): Promise<number> {
  const r = await tx.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*) AS n FROM "User"
    WHERE role = 'ADMIN' AND password IS NOT NULL AND password NOT LIKE ${LOCK_PREFIX + "%"}`
  return Number(r[0]?.n ?? 0)
}

async function main() {
  if (command === "create-admin") {
    const email = (arg("email") ?? "").trim().toLowerCase()
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? ""
    const problem = adminPasswordProblem(password)
    if (problem) fail(`ADMIN_BOOTSTRAP_PASSWORD refused: ${problem}`)
    const existing = await prisma.user.findUnique({ where: { email }, select: { email: true } })
    const plan = planCreateAdmin({ email, existing })
    if (!plan.ok) fail(`create-admin refused: ${plan.reason}`)
    console.log(`[account-access] plan: create ADMIN ${email}`)
    if (!apply) return console.log("[account-access] dry run — add --apply to write")
    const hash = await bcrypt.hash(password, 12)
    await prisma.user.create({ data: { email, password: hash, role: "ADMIN", name: "Admin" } })
    console.log(`[account-access] created ADMIN ${email} (sign in, then lock the old admin)`)
    return
  }

  const emails = (arg("emails") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  const expect = Number(arg("expect"))
  if (!Number.isInteger(expect) || expect < 1) fail("--expect <n> is required (the exact number of accounts)")

  const rows = await readRows(prisma, emails, false)
  const plan =
    command === "lock"
      ? planLock({ emails, expect, rows, unlockedAdminsTotal: await unlockedAdmins(prisma) })
      : planUnlock({ emails, expect, rows })
  if (!plan.ok || !plan.targets) fail(`${command} refused: ${plan.reason}${"detail" in plan && plan.detail ? ` (${plan.detail.join(", ")})` : ""}`)
  console.log(`[account-access] plan: ${command} ${plan.targets.length} account(s): ${plan.targets.join(", ")}`)
  if (!apply) return console.log("[account-access] dry run — add --apply to write")

  const tag = lockTag()
  const changed = await prisma.$transaction(async (tx) => {
    const fresh = await readRows(tx, emails, true)
    const again =
      command === "lock"
        ? planLock({ emails, expect, rows: fresh, unlockedAdminsTotal: await unlockedAdmins(tx) })
        : planUnlock({ emails, expect, rows: fresh })
    if (!again.ok || !again.targets) throw new Error(`plan changed during the operation: ${again.reason}`)
    const n =
      command === "lock"
        ? await tx.$executeRaw`
            UPDATE "User" SET password = ${tag} || password
            WHERE lower(email) IN (${Prisma.join(again.targets)}) AND password IS NOT NULL AND password NOT LIKE ${LOCK_PREFIX + "%"}`
        : await tx.$executeRaw`
            UPDATE "User" SET password = regexp_replace(password, '^locked-[0-9]{4}-[0-9]{2}-[0-9]{2}:', '')
            WHERE lower(email) IN (${Prisma.join(again.targets)}) AND password LIKE ${LOCK_PREFIX + "%"}`
    if (n !== expect) throw new Error(`expected ${expect} row(s), would change ${n} — rolled back`)
    return n
  })
  console.log(`[account-access] ${command}: ${changed} account(s) changed`)
}

main()
  .catch((err) => fail(err instanceof Error ? err.message : String(err)))
  .finally(() => prisma.$disconnect())
