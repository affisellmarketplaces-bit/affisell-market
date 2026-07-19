import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv({ path: ".env" })

function upsertEnvLine(text: string, key: string, value: string): string {
  const line = `${key}="${value}"`
  if (new RegExp(`^${key}=`, "m").test(text)) {
    return text.replace(new RegExp(`^${key}=.*$`, "m"), line)
  }
  return `${text.trimEnd()}\n${line}\n`
}

async function main() {
  const {
    resolveOrEnsureStripeRadarPriceId,
    RADAR_PRO_PRICE_LOOKUP_KEY,
    RADAR_GLOBAL_PRICE_LOOKUP_KEY,
  } = await import("../lib/stripe-radar-ensure")

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    console.error("[stripe:ensure-radar] STRIPE_SECRET_KEY missing")
    process.exit(1)
  }

  const proId = await resolveOrEnsureStripeRadarPriceId("pro")
  const globalId = await resolveOrEnsureStripeRadarPriceId("global")

  if (!proId || !globalId) {
    console.error("[stripe:ensure-radar] failed", { proId, globalId })
    process.exit(1)
  }

  console.log("[stripe:ensure-radar]", {
    result: "ok",
    pro: { priceId: proId, lookupKey: RADAR_PRO_PRICE_LOOKUP_KEY },
    global: { priceId: globalId, lookupKey: RADAR_GLOBAL_PRICE_LOOKUP_KEY },
  })

  const envPath = resolve(process.cwd(), ".env.local")
  if (existsSync(envPath)) {
    let text = readFileSync(envPath, "utf8")
    text = upsertEnvLine(text, "STRIPE_RADAR_PRO_PRICE_ID", proId)
    text = upsertEnvLine(text, "STRIPE_RADAR_GLOBAL_PRICE_ID", globalId)
    writeFileSync(envPath, text, "utf8")
    console.log(
      "[stripe:ensure-radar] wrote STRIPE_RADAR_PRO_PRICE_ID + STRIPE_RADAR_GLOBAL_PRICE_ID → .env.local"
    )
  } else {
    console.log(
      "[stripe:ensure-radar] add to Vercel / .env.local:\n" +
        `STRIPE_RADAR_PRO_PRICE_ID=${proId}\n` +
        `STRIPE_RADAR_GLOBAL_PRICE_ID=${globalId}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
