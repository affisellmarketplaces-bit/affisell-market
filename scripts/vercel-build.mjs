#!/usr/bin/env node
/**
 * Vercel production build.
 * - Requires DATABASE_URL (Neon direct URL recommended, not pooler-only).
 * - Hobby plan: vercel.json crons must be once per day only.
 */
import { execSync } from "node:child_process"

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
      "Use Neon *direct* connection string (host without -pooler) when possible.",
    ].join("\n")
  )
  process.exit(1)
}

try {
  run("npx prisma generate")
  runMigrations()
  run("npm run build")
  console.log("\n✓ Vercel build completed successfully.")
} catch (error) {
  console.error("\n✗ Vercel build failed.")
  if (error instanceof Error && error.message) {
    console.error(error.message)
  }
  process.exit(1)
}
