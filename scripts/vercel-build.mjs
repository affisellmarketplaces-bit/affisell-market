#!/usr/bin/env node
/**
 * Vercel production build: Prisma generate → heal Neon (P3009) → migrate deploy → next build.
 */
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { config as loadEnv } from "dotenv"
import { ensureDirectUrl } from "./ensure-direct-url.mjs"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

const MIGRATION_DIR = join(process.cwd(), "prisma/migrations")

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
    return { ok: true, output: stdout.trim() }
  } catch (error) {
    const err = error
    const stdout = err?.stdout?.toString?.() ?? ""
    const stderr = err?.stderr?.toString?.() ?? ""
    return { ok: false, output: `${stdout}\n${stderr}`.trim(), code: err?.status }
  }
}

function execSqlFile(relativePath, label) {
  console.log(`\n> ${label}`)
  const result = execPrisma(
    `db execute --file ${relativePath} --schema prisma/schema.prisma`
  )
  if (result.ok) {
    console.log(`✓ ${label}`)
    return true
  }
  console.log(`⚠ ${label} (continuing)`)
  if (result.output) console.log(result.output)
  return false
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

function resolveFailedMigrations(names) {
  for (const name of names) {
    console.log(`\n> npx prisma migrate resolve --applied ${name}`)
    const result = execPrisma(`migrate resolve --applied ${name}`)
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

function healMigrationHistory() {
  execSqlFile("prisma/deploy-repair.sql", "deploy-repair.sql (schema)")
  execSqlFile("prisma/fix-p3009-migrations.sql", "fix-p3009-migrations.sql (clear failed rows)")

  const status = execPrisma("migrate status")
  const failed = parseFailedMigrationNames(status.output)
  if (failed.length > 0) {
    console.log(`\nPrisma still reports failed: ${failed.join(", ")}`)
    resolveFailedMigrations(failed)
    execSqlFile("prisma/fix-p3009-migrations.sql", "fix-p3009-migrations.sql (retry)")
  }
}

function runMigrations() {
  healMigrationHistory()

  const localMigrations = listLocalMigrationNames()
  console.log(`\nLocal migrations: ${localMigrations.length} in prisma/migrations/`)

  console.log("\n> npx prisma migrate deploy")
  const deploy = execPrisma("migrate deploy")
  if (deploy.output) console.log(deploy.output)

  if (!deploy.ok) {
    if (/P3009/i.test(deploy.output)) {
      console.log("\nP3009 after heal — running second repair cycle")
      healMigrationHistory()
      const retry = execPrisma("migrate deploy")
      if (retry.output) console.log(retry.output)
      if (!retry.ok) {
        console.error("\n✗ migrate deploy still failing after P3009 repair.")
        process.exit(1)
      }
    } else {
      console.error("\n✗ migrate deploy failed.")
      process.exit(1)
    }
  }

  const status = execPrisma("migrate status")
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

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    [
      "ERROR: DATABASE_URL is not set for the Vercel build.",
      "Vercel → Settings → Environment Variables → Production (+ Preview recommended)",
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
  console.error("\n✗ Vercel build failed (uncaught).")
  if (error instanceof Error && error.message) console.error(error.message)
  if (error && typeof error === "object" && "stdout" in error) {
    const stdout = error.stdout?.toString?.()
    const stderr = error.stderr?.toString?.()
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
  }
  process.exit(1)
}
