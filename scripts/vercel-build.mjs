#!/usr/bin/env node
/**
 * Vercel production build.
 * - Requires DATABASE_URL (pooled Neon OK; DIRECT_URL auto-derived if missing).
 */
import { execSync } from "node:child_process"
import { ensureDirectUrl } from "./ensure-direct-url.mjs"

const MIGRATIONS_TO_MARK_APPLIED = [
  "20260528140000_processed_webhook_status_capabilities",
]

function run(command, options = {}) {
  console.log(`\n> ${command}`)
  return execSync(command, { stdio: "inherit", env: process.env, ...options })
}

function runCapture(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    const err = error
    const stdout = err?.stdout?.toString?.() ?? ""
    const stderr = err?.stderr?.toString?.() ?? ""
    return `${stdout}\n${stderr}`
  }
}

function resolveKnownFailedMigrations() {
  for (const name of MIGRATIONS_TO_MARK_APPLIED) {
    try {
      console.log(`\n> npx prisma migrate resolve --applied ${name}`)
      execSync(`npx prisma migrate resolve --applied ${name}`, {
        stdio: "inherit",
        env: process.env,
      })
    } catch {
      console.log(`(skip resolve ${name} — not in failed state)`)
    }
  }
}

function runMigrations() {
  console.log("\n> Applying prisma/deploy-repair.sql (idempotent)")
  try {
    run("npx prisma db execute --file prisma/deploy-repair.sql --schema prisma/schema.prisma")
  } catch {
    console.log("(deploy-repair skipped or partial — continuing)")
  }

  resolveKnownFailedMigrations()

  const output = runCapture("npx prisma migrate deploy")
  if (output) {
    console.log(output)
  }

  const status = runCapture("npx prisma migrate status")
  if (status.includes("Database schema is up to date")) {
    console.log("\nPrisma migrations: up to date")
    return
  }

  if (
    status.includes("failed migrations") ||
    status.includes("P3009") ||
    status.includes("already exists")
  ) {
    console.error("\nPrisma migrate deploy did not reach a clean state.")
    console.error(status)
    process.exit(1)
  }

  console.log(status)
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
