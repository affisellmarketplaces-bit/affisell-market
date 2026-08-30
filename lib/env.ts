import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { config } from "dotenv"

const STAGING_NEON_MARKER = "shy-wind"

let envLoaded = false

/** Load `.env.local` then `.env` (idempotent, never overrides existing process.env). */
export function loadEnv(): void {
  if (envLoaded) return
  if (typeof process === "undefined") return

  const root = process.cwd()
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

/** Scan process.env for any *STAGING* var pointing at Neon staging (ep-shy-wind). */
export function findStagingDatabaseUrlFromEnv(): string | null {
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

/** Resolved DB URL without throwing — for banners / diagnostics. */
export function resolveDatabaseUrlOptional(): string | null {
  loadEnv()
  return process.env.DATABASE_URL?.trim() || findStagingDatabaseUrlFromEnv()
}

/** Primary DATABASE_URL with staging fallbacks from `.env.local`. */
export function getDatabaseUrl(): string {
  const resolved = resolveDatabaseUrlOptional()
  if (resolved) return resolved

  throw new Error("Dona: DATABASE_URL et STAGING manquants, vérifie .env.local")
}

/** Staging branch URL for `npm run dev:staging`. */
export function resolveStagingDatabaseUrl(): string | null {
  loadEnv()
  return findStagingDatabaseUrlFromEnv()
}

export function applyStagingDevEnv(stagingUrl: string): void {
  process.env.DATABASE_URL = stagingUrl
  process.env.AFFISELL_DEV_STAGING = "1"
}

export { STAGING_NEON_MARKER }
