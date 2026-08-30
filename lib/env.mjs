import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "dotenv"

const STAGING_NEON_MARKER = "shy-wind"

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

/** @returns {string | null} */
export function findStagingDatabaseUrlFromEnv() {
  const explicit = process.env.DATABASE_URL_STAGING?.trim()
  if (explicit) return explicit

  for (const [key, value] of Object.entries(process.env)) {
    if (!value?.trim()) continue
    if (!key.toUpperCase().includes("STAGING")) continue
    const trimmed = value.trim()
    if (
      trimmed.includes(STAGING_NEON_MARKER) ||
      trimmed.startsWith("postgresql://") ||
      trimmed.startsWith("postgres://")
    ) {
      return trimmed
    }
  }

  return null
}

/** @returns {string | null} */
export function resolveDatabaseUrlOptional() {
  loadEnv()
  return process.env.DATABASE_URL?.trim() || findStagingDatabaseUrlFromEnv()
}

/** @returns {string} */
export function getDatabaseUrl() {
  const resolved = resolveDatabaseUrlOptional()
  if (resolved) return resolved

  throw new Error("Dona: DATABASE_URL et STAGING manquants, vérifie .env.local")
}

/** @returns {string | null} */
export function resolveStagingDatabaseUrl() {
  loadEnv()

  const fromStagingKey = findStagingDatabaseUrlFromEnv()
  if (fromStagingKey) return fromStagingKey

  const primary = process.env.DATABASE_URL?.trim()
  if (primary?.includes(STAGING_NEON_MARKER)) {
    return primary
  }

  return null
}

/** @param {string} stagingUrl */
export function applyStagingDevEnv(stagingUrl) {
  process.env.DATABASE_URL = stagingUrl
  process.env.AFFISELL_DEV_STAGING = "1"
}

export { STAGING_NEON_MARKER }
