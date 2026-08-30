#!/usr/bin/env node
/**
 * npm run dev:staging — load .env.local, wire DATABASE_URL_STAGING → DATABASE_URL, start dev.
 */
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  applyStagingDevEnv,
  loadEnv,
  resolveStagingDatabaseUrl,
} from "../lib/env.loader.mjs"

const root = dirname(dirname(fileURLToPath(import.meta.url)))

loadEnv()

const stagingUrl = resolveStagingDatabaseUrl()
if (!stagingUrl) {
  console.error("")
  console.error(
    "[dona] ❌ DATABASE_URL_STAGING introuvable dans .env.local — copie .env.local.example"
  )
  console.error("")
  process.exit(1)
}

applyStagingDevEnv(stagingUrl)

function run(scriptRelativePath) {
  const scriptPath = join(root, scriptRelativePath)
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run("scripts/dona.mjs")
run("scripts/dev-preflight.mjs")
run("scripts/next-dev-port.mjs")
