#!/usr/bin/env node
/**
 * Vercel production build.
 * - Requires DATABASE_URL (pooled Neon OK; DIRECT_URL auto-derived if missing).
 * - Repairs failed/partial Prisma migrations on Neon before migrate deploy.
 */
import { execSync } from "node:child_process"
import { ensureDirectUrl } from "./ensure-direct-url.mjs"

const MAX_MIGRATE_ATTEMPTS = 6

function run(command, options = {}) {
  console.log(`\n> ${command}`)
  return execSync(command, { stdio: "inherit", env: process.env, ...options })
}

function execPrisma(args) {
  const cmd = `npx prisma ${args}`
  try {
    const stdout = execSync(cmd, {
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { ok: true, output: stdout }
  } catch (error) {
    const err = error
    const stdout = err?.stdout?.toString?.() ?? ""
    const stderr = err?.stderr?.toString?.() ?? ""
    return { ok: false, output: `${stdout}\n${stderr}`.trim(), code: err?.status }
  }
}

function parseFailedMigrationNames(text) {
  const names = new Set()
  if (!text) return []

  const failedBlock = text.match(/following migration\(s\) have failed:\s*([\s\S]*?)(?:\n\n|$)/i)
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

function runDeployRepair() {
  console.log("\n> Applying prisma/deploy-repair.sql (idempotent)")
  const result = execPrisma(
    'db execute --file prisma/deploy-repair.sql --schema prisma/schema.prisma'
  )
  if (result.ok) {
    console.log("✓ deploy-repair.sql applied")
    return
  }
  console.log("(deploy-repair partial — continuing)")
  if (result.output) console.log(result.output)
}

function resolveFailedMigrations(names) {
  for (const name of names) {
    console.log(`\n> npx prisma migrate resolve --applied ${name}`)
    const result = execPrisma(`migrate resolve --applied ${name}`)
    if (result.ok) {
      console.log(`✓ Marked ${name} as applied`)
      continue
    }
    if (/P3008/i.test(result.output)) {
      console.log(`(skip ${name} — already recorded as applied)`)
      continue
    }
    if (/not found|not in a failed state|failed state/i.test(result.output)) {
      console.log(`(skip ${name} — not in failed state)`)
      continue
    }
    console.log(`(resolve ${name} note: ${result.output.split("\n")[0] ?? "unknown"})`)
  }
}

function runMigrations() {
  runDeployRepair()

  for (let attempt = 1; attempt <= MAX_MIGRATE_ATTEMPTS; attempt++) {
    const statusBefore = execPrisma("migrate status")
    const failedBefore = parseFailedMigrationNames(statusBefore.output)
    if (failedBefore.length > 0) {
      console.log(`\nRepairing failed migration record(s): ${failedBefore.join(", ")}`)
      runDeployRepair()
      resolveFailedMigrations(failedBefore)
    }

    console.log(`\n> npx prisma migrate deploy (attempt ${attempt}/${MAX_MIGRATE_ATTEMPTS})`)
    const deploy = execPrisma("migrate deploy")
    if (deploy.output) console.log(deploy.output)

    if (deploy.ok) {
      const statusAfter = execPrisma("migrate status")
      if (statusAfter.output.includes("Database schema is up to date")) {
        console.log("\n✓ Prisma migrations: up to date")
        return
      }
      console.log(statusAfter.output)
      return
    }

    const failedFromDeploy = parseFailedMigrationNames(deploy.output)
    if (failedFromDeploy.length > 0) {
      runDeployRepair()
      resolveFailedMigrations(failedFromDeploy)
      continue
    }

    console.error("\n✗ prisma migrate deploy failed without a recoverable failed migration.")
    if (deploy.output) console.error(deploy.output)
    process.exit(1)
  }

  console.error("\n✗ Prisma migrate deploy did not reach a clean state after retries.")
  process.exit(1)
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    [
      "ERROR: DATABASE_URL is not set for the Vercel build.",
      "Vercel → Project → Settings → Environment Variables → Production",
      "Enable: Production + Preview + Development (for migrate deploy at build time)",
      "Set DATABASE_URL (Neon; ?pgbouncer=true is OK). DIRECT_URL is optional.",
    ].join("\n")
  )
  process.exit(1)
}

ensureDirectUrl()

try {
  console.log("BUILD_START")
  run("npx prisma generate")
  runMigrations()
  run("npm run build")
  console.log("\nNext.js build completed")
  console.log("✓ Vercel build completed successfully.")
} catch (error) {
  console.error("\n✗ Vercel build failed.")
  if (error instanceof Error && error.message) {
    console.error(error.message)
  }
  process.exit(1)
}
