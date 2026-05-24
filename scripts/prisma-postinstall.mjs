#!/usr/bin/env node
/** postinstall: generate Prisma client when DATABASE_URL is available (skips on CI without DB). */
import { execSync } from "node:child_process"

if (!process.env.DATABASE_URL?.trim()) {
  console.log("prisma-postinstall: skip generate (DATABASE_URL not set)")
  process.exit(0)
}

execSync("npx prisma generate", { stdio: "inherit", env: process.env })
