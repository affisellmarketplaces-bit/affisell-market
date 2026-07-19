/**
 * Trigger Radar multi-country global-scan without manual curl.
 *
 * Usage:
 *   npm run radar:crawl -- FR,US,MX
 *   npm run radar:crawl:prod -- FR,US,MX
 *   CRON_SECRET=xxx URL=http://localhost:3001 npm run radar:crawl
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"

const root = process.cwd()
for (const name of [".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

function resolveBaseUrl(): string {
  const raw =
    process.env.URL?.trim() ||
    process.env.RADAR_CRAWL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001"
  return raw.replace(/\/$/, "")
}

/** npm run radar:crawl -- FR,US,MX → argv[2]=FR,US,MX (sometimes argv[3] if `--` leaked). */
function resolveCountries(): string {
  const args = process.argv.slice(2).filter((a) => a && a !== "--")
  const raw = (args[0] || "FR,US,MX").trim()
  if (!raw || raw.includes("--") || raw.startsWith("-")) return "FR,US,MX"
  return raw
}

async function main(): Promise<void> {
  const baseUrl = resolveBaseUrl()
  const cronSecret = process.env.CRON_SECRET?.trim()
  const countries = resolveCountries()

  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    console.error(
      "❌ URL manquant. Ex: URL=http://localhost:3001 npm run radar:crawl"
    )
    process.exit(1)
  }

  if (!cronSecret) {
    console.error("❌ CRON_SECRET manquant dans .env / .env.local")
    process.exit(1)
  }

  const endpoint = `${baseUrl}/api/radar/cron/global-scan?countries=${encodeURIComponent(countries)}`

  console.log(`🚀 Crawl ${countries} sur ${baseUrl}...`)
  console.log(`   GET ${endpoint}`)

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "x-cron-secret": cronSecret,
        accept: "application/json",
      },
    })

    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text) as unknown
    } catch {
      console.error(`❌ Réponse non-JSON (HTTP ${res.status}):`, text.slice(0, 400))
      process.exit(1)
    }

    console.log(JSON.stringify(json, null, 2))

    if (!res.ok) {
      console.error(`❌ Crawl failed (HTTP ${res.status})`)
      process.exit(1)
    }

    console.log("✅ Crawl terminé — check /admin/radar in ~30s")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("❌ Fetch failed:", message)
    if (/URL rejected|Invalid URL|No host/i.test(message)) {
      console.error(
        "   → URL env was empty or invalid. Use: URL=http://localhost:3001 npm run radar:crawl"
      )
    }
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
