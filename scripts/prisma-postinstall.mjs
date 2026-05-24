#!/usr/bin/env node
/** postinstall: generate Prisma client when DATABASE_URL is available (skips on CI without DB). */
import { execSync } from "node:child_process"
import { ensureDirectUrl } from "./ensure-direct-url.mjs"

if (!process.env.DATABASE_URL?.trim()) {
  console.log("prisma-postinstall: skip generate (DATABASE_URL not set)")
  process.exit(0)
}

ensureDirectUrl()
execSync("npx prisma generate", { stdio: "inherit", env: process.env })
