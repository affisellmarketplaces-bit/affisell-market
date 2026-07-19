import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

import { config as loadEnv } from "dotenv"

loadEnv({ path: ".env.local" })
loadEnv({ path: ".env" })

async function main() {
  const { resolveOrEnsureStripeRadarGlobalPriceId, RADAR_GLOBAL_PRICE_LOOKUP_KEY } =
    await import("../lib/stripe-radar-ensure")

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    console.error("[stripe:ensure-radar] STRIPE_SECRET_KEY missing")
    process.exit(1)
  }

  const priceId = await resolveOrEnsureStripeRadarGlobalPriceId()
  if (!priceId) {
    console.error("[stripe:ensure-radar] failed to resolve/create Global price")
    process.exit(1)
  }

  console.log("[stripe:ensure-radar]", {
    result: "ok",
    priceId,
    lookupKey: RADAR_GLOBAL_PRICE_LOOKUP_KEY,
  })

  const envPath = resolve(process.cwd(), ".env.local")
  if (existsSync(envPath)) {
    let text = readFileSync(envPath, "utf8")
    const line = `STRIPE_RADAR_GLOBAL_PRICE_ID="${priceId}"`
    if (/^STRIPE_RADAR_GLOBAL_PRICE_ID=/m.test(text)) {
      text = text.replace(/^STRIPE_RADAR_GLOBAL_PRICE_ID=.*$/m, line)
    } else {
      text = `${text.trimEnd()}\n\n# Affisell Radar Global ($99) — auto by npm run stripe:ensure-radar\n${line}\n`
    }
    writeFileSync(envPath, text, "utf8")
    console.log("[stripe:ensure-radar] wrote STRIPE_RADAR_GLOBAL_PRICE_ID → .env.local")
  } else {
    console.log(
      "[stripe:ensure-radar] add to Vercel / .env.local:\nSTRIPE_RADAR_GLOBAL_PRICE_ID=" + priceId
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
