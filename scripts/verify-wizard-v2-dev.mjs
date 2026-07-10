#!/usr/bin/env node
/**
 * Preflight wizard v2 local dev: PORT / URL alignment + shell-safe entry URL.
 * Usage: npm run verify:wizard-v2:dev
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config } from "dotenv"
import {
  buildWizardV2NewProductUrl,
  quoteShellUrl,
  WIZARD_V2_NEW_PRODUCT_PATH,
} from "./wizard-v2-dev-url.mjs"
import {
  devLocalhostOrigin,
  isDevEnvPortAligned,
  resolveDevPort,
} from "./dev-localhost-url.mjs"

const root = process.cwd()
const hasLocal = existsSync(resolve(root, ".env.local"))
if (hasLocal) config({ path: resolve(root, ".env.local") })
if (existsSync(resolve(root, ".env"))) config({ path: resolve(root, ".env") })

const port = resolveDevPort(process.env)
const origin = devLocalhostOrigin(process.env)
const wizardUrl = buildWizardV2NewProductUrl()
const wizardEnabled =
  process.env.ENABLE_WIZARD_V2?.trim() === "1" ||
  process.env.ENABLE_WIZARD_V2?.trim().toLowerCase() === "true"

console.log("[verify:wizard-v2:dev]", {
  port,
  origin,
  wizardV2Env: wizardEnabled,
  envFile: hasLocal ? ".env.local" : ".env only",
})

if (!isDevEnvPortAligned(process.env)) {
  console.error(
    "[verify:wizard-v2:dev] PORT mismatch — align PORT, NEXT_PUBLIC_APP_URL, NEXTAUTH_URL in .env.local"
  )
  console.error(`[verify:wizard-v2:dev] Expected origin: ${origin}`)
  process.exit(1)
}

console.log("[verify:wizard-v2:dev] Wizard v2 path:", WIZARD_V2_NEW_PRODUCT_PATH)
console.log("[verify:wizard-v2:dev] Shell-safe URL:", quoteShellUrl(wizardUrl))
console.log("[verify:wizard-v2:dev] Open browser: npm run dev:open:wizard-v2")
console.log("[verify:wizard-v2:dev] OK")
