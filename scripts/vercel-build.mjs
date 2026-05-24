#!/usr/bin/env node
/**
 * Vercel production build: Prisma client + migrations + Next.js.
 * Requires DATABASE_URL on Vercel (Production). Use Neon direct host, not pooler, when possible.
 */
import { execSync } from "node:child_process"

function run(command) {
  console.log(`\n> ${command}`)
  execSync(command, { stdio: "inherit", env: process.env })
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    [
      "ERROR: DATABASE_URL is not set.",
      "Vercel → Settings → Environment Variables → Production → DATABASE_URL (Neon connection string)",
    ].join("\n")
  )
  process.exit(1)
}

try {
  run("npx prisma generate")
  run("npx prisma migrate deploy")
  run("npm run build")
  console.log("\nVercel build completed successfully.")
} catch (error) {
  console.error("\nVercel build failed. Check Prisma migrate deploy output above.")
  if (error instanceof Error && error.message) {
    console.error(error.message)
  }
  process.exit(1)
}
