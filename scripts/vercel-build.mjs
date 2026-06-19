#!/usr/bin/env node
/**
 * Vercel production build: Prisma generate → heal Neon (P3009) → migrate deploy → next build.
 * Retries P1001/P1002 (Neon cold start / transient) before failing the deploy.
 */
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { setTimeout } from "node:timers/promises"
import { config as loadEnv } from "dotenv"
import { ensureDirectUrl } from "./ensure-direct-url.mjs"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

const MIGRATION_DIR = join(process.cwd(), "prisma/migrations")
const RETRY_DELAYS_MS = [3_000, 5_000, 8_000, 12_000, 15_000, 20_000]

function run(command, options = {}) {
  console.log(`\n> ${command}`)
  return execSync(command, { stdio: "inherit", env: process.env, ...options })
}

function maskUrl(url) {
  if (!url?.trim()) return "(unset)"
  try {
    const parsed = new URL(url)
    if (parsed.password) parsed.password = "***"
    return `${parsed.hostname}${parsed.pathname}${parsed.search ? "?…" : ""}`
  } catch {
    return "(invalid)"
  }
}

function isTransientDbError(output) {
  return /P1001|P1002|P1017|Can't reach database server|connection timed out|ECONNREFUSED|ENOTFOUND/i.test(
    output
  )
}

function execPrismaOnce(args) {
  const cmd = `npx prisma ${args}`
  try {
    const stdout = execSync(cmd, {
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { ok: true, output: stdout.trim() }
  } catch (error) {
    const err = error
    const stdout = err?.stdout?.toString?.() ?? ""
    const stderr = err?.stderr?.toString?.() ?? ""
    return { ok: false, output: `${stdout}\n${stderr}`.trim(), code: err?.status }
  }
}

async function execPrisma(args, label = args) {
  const maxAttempts = RETRY_DELAYS_MS.length + 1
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = execPrismaOnce(args)
    if (result.ok || !isTransientDbError(result.output)) {
      return result
    }
    if (attempt >= maxAttempts) {
      return result
    }
    const wait = RETRY_DELAYS_MS[attempt - 1] ?? 10_000
    console.log(
      `\n⚠ ${label}: DB unreachable (P1001/transient), retry ${attempt}/${maxAttempts - 1} in ${wait / 1000}s…`
    )
    await setTimeout(wait)
  }
  return { ok: false, output: "retry exhausted" }
}

function listLocalMigrationNames() {
  return readdirSync(MIGRATION_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^\d{14}_/.test(name))
    .sort()
}

function parseFailedMigrationNames(text) {
  const names = new Set()
  if (!text) return []

  const failedBlock = text.match(
    /following migration\(s\) have failed:\s*([\s\S]*?)(?:\n\n|To fix|Run|$)/i
  )
  if (failedBlock?.[1]) {
    for (const line of failedBlock[1].split("\n")) {
      const match = line.trim().match(/^(\d{14}_[a-z0-9_]+)/i)
      if (match) names.add(match[1])
    }
  }

  for (const match of text.matchAll(/`(\d{14}_[a-z0-9_]+)` migration/gi)) {
    names.add(match[1])
  }

  return [...names]
}

async function resolveFailedMigrations(names) {
  for (const name of names) {
    console.log(`\n> npx prisma migrate resolve --applied ${name}`)
    const result = await execPrisma(`migrate resolve --applied ${name}`, `resolve ${name}`)
    if (result.ok) {
      console.log(`✓ ${name}`)
      continue
    }
    if (/P3008/i.test(result.output)) {
      console.log(`  (${name} already applied)`)
      continue
    }
    console.log(`  (resolve note: ${(result.output.split("\n").find(Boolean) ?? "skipped").slice(0, 120)})`)
  }
}

async function execSqlFile(relativePath, label) {
  console.log(`\n> ${label}`)
  const result = await execPrisma(
    `db execute --file ${relativePath} --schema prisma/schema.prisma`,
    label
  )
  if (result.ok) {
    console.log(`✓ ${label}`)
    return true
  }
  if (isTransientDbError(result.output)) {
    console.error(`✗ ${label} — database unreachable after retries`)
    if (result.output) console.log(result.output)
    return false
  }
  console.log(`⚠ ${label} (continuing)`)
  if (result.output) console.log(result.output)
  return false
}

async function healMigrationHistory() {
  await execSqlFile("prisma/deploy-repair.sql", "deploy-repair.sql (schema)")
  await execSqlFile("prisma/fix-p3009-migrations.sql", "fix-p3009-migrations.sql (clear failed rows)")

  const status = await execPrisma("migrate status", "migrate status")
  const failed = parseFailedMigrationNames(status.output)
  if (failed.length > 0) {
    console.log(`\nPrisma still reports failed: ${failed.join(", ")}`)
    await resolveFailedMigrations(failed)
    await execSqlFile("prisma/fix-p3009-migrations.sql", "fix-p3009-migrations.sql (retry)")
  }
}

async function runMigrations() {
  if (process.env.BUILD_SKIP_MIGRATIONS === "1") {
    console.log("\n⚠ BUILD_SKIP_MIGRATIONS=1 — skipping migrate deploy (Next build only)")
    return
  }

  await healMigrationHistory()

  const localMigrations = listLocalMigrationNames()
  console.log(`\nLocal migrations: ${localMigrations.length} in prisma/migrations/`)

  console.log("\n> npx prisma migrate deploy")
  let deploy = await execPrisma("migrate deploy", "migrate deploy")
  if (deploy.output) console.log(deploy.output)

  if (!deploy.ok) {
    if (/P3009/i.test(deploy.output)) {
      console.log("\nP3009 after heal — running second repair cycle")
      await healMigrationHistory()
      deploy = await execPrisma("migrate deploy", "migrate deploy retry")
      if (deploy.output) console.log(deploy.output)
    }
    if (!deploy.ok) {
      console.error("\n✗ migrate deploy failed.")
      if (isTransientDbError(deploy.output)) {
        console.error(
          [
            "Neon P1001 checklist:",
            "  1. Wake project in Neon console (compute may be suspended)",
            "  2. Vercel env: DATABASE_URL (pooler) + DATABASE_URL_UNPOOLED (direct host, no -pooler)",
            "  3. sslmode=require on both URLs",
            "  4. Retry deploy — build retries transient errors up to ~60s",
          ].join("\n")
        )
      }
      process.exit(1)
    }
  }

  const status = await execPrisma("migrate status", "migrate status final")
  if (status.output.includes("Database schema is up to date")) {
    console.log("\n✓ Prisma migrations: up to date")
    return
  }

  if (parseFailedMigrationNames(status.output).length > 0) {
    console.error("\n✗ Failed migrations remain after deploy:")
    console.error(status.output)
    process.exit(1)
  }

  console.log(status.output || "\n✓ migrate deploy completed")
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      [
        "ERROR: DATABASE_URL is not set for the Vercel build.",
        "Vercel → Settings → Environment Variables → Production (+ Preview)",
      ].join("\n")
    )
    process.exit(1)
  }

  ensureDirectUrl()
  console.log("[vercel-build] DATABASE_URL host:", maskUrl(process.env.DATABASE_URL))
  console.log(
    "[vercel-build] DATABASE_URL_UNPOOLED host:",
    maskUrl(process.env.DATABASE_URL_UNPOOLED ?? process.env.DIRECT_URL)
  )

  console.log("BUILD_START")
  run("npx prisma generate")
  await runMigrations()
  run("npm run check:client-prisma")
  run("npm run build")
  console.log("\nNext.js build completed")
  console.log("✓ Vercel build completed successfully.")
}

main().catch((error) => {
  console.error("\n✗ Vercel build failed (uncaught).")
  if (error instanceof Error && error.message) console.error(error.message)
  process.exit(1)
})
