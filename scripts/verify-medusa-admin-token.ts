#!/usr/bin/env npx tsx
/** Verify MEDUSA_ADMIN_TOKEN against local Medusa Admin API. */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"

import { medusaBackendUrl } from "../lib/medusa/backend-url"

const root = resolve(import.meta.dirname, "..")
const medusaEnv = resolve(root, "medusa-backend", ".env")

if (existsSync(medusaEnv)) loadEnv({ path: medusaEnv, override: true })
loadEnv({ path: resolve(root, ".env.local"), override: false })

async function main() {
  const token = process.env.MEDUSA_ADMIN_TOKEN?.trim()
  if (!token) {
    console.error("[medusa-verify] MEDUSA_ADMIN_TOKEN missing")
    process.exit(1)
  }

  const res = await fetch(`${medusaBackendUrl()}/admin/regions?limit=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  })

  if (res.ok) {
    console.log("[medusa-verify] OK — Secret API Key valid", { status: res.status })
    process.exit(0)
  }

  const body = await res.text()
  console.error("[medusa-verify] FAILED", {
    status: res.status,
    hint:
      res.status === 401
        ? "Create Secret API Key in Medusa Admin → Settings → Secret API Keys (not publishable pk_)"
        : body.slice(0, 200),
  })
  process.exit(1)
}

main()
