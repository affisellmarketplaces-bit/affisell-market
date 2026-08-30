/**
 * Node-only — loads `.env.local` / `.env` then re-exports pure env helpers.
 * Do not import from Next.js runtime (use `@/lib/env` instead).
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "dotenv"

export {
  applyStagingDevEnv,
  findStagingDatabaseUrlFromEnv,
  getDatabaseUrl,
  getEnvInfo,
  resolveDatabaseUrlOptional,
  resolveStagingDatabaseUrl,
} from "./env.pure.mjs"

let envLoaded = false

function projectRoot() {
  return resolve(fileURLToPath(new URL("..", import.meta.url)))
}

/** Load `.env.local` then `.env` (idempotent, never overrides existing process.env). */
export function loadEnv() {
  if (envLoaded) return

  const root = projectRoot()
  const localPath = resolve(root, ".env.local")
  const envPath = resolve(root, ".env")

  if (existsSync(localPath)) {
    config({ path: localPath })
  }
  if (existsSync(envPath)) {
    config({ path: envPath })
  }

  envLoaded = true
}
