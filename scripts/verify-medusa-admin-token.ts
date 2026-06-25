#!/usr/bin/env npx tsx
/** Verify MEDUSA_ADMIN_TOKEN against local Medusa Admin API. */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"

const root = resolve(import.meta.dirname, "..")
const medusaEnv = resolve(root, "medusa-backend", ".env")

if (existsSync(medusaEnv)) loadEnv({ path: medusaEnv, override: true })
loadEnv({ path: resolve(root, ".env.local"), override: false })

async function main() {
  const { medusaAdminFetch, resolveMedusaAdminToken } = await import("../lib/medusa-admin.impl")

  try {
    resolveMedusaAdminToken()
  } catch {
    console.error("[medusa-verify] MEDUSA_ADMIN_TOKEN missing in .env.local or medusa-backend/.env")
    process.exit(1)
  }

  try {
    await medusaAdminFetch<{ regions?: unknown[] }>("/admin/regions?limit=1")
    console.log("[medusa-verify] OK — Secret API Key valid")
    process.exit(0)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[medusa-verify] FAILED", {
      error: msg,
      hint:
        msg.includes("401")
          ? "Use Secret API Key (sk_…) from Medusa Admin → Settings → Secret API Keys"
          : undefined,
    })
    process.exit(1)
  }
}

main()
