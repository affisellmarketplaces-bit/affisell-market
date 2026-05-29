/**
 * Run discovery fixes in priority order (idempotent).
 *
 * Run: npm run discovery:bootstrap
 */
import { config } from "dotenv"
import { resolve } from "node:path"
import { execSync } from "node:child_process"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const steps: Array<{ name: string; cmd: string }> = [
  { name: "pg_trgm indexes", cmd: "npm run index:marketplace-search" },
  { name: "sync category labels", cmd: "npm run sync:category-labels" },
  { name: "reclassify orphans", cmd: "npm run reclassify-orphans" },
  { name: "reclassify active catalog", cmd: "npm run reclassify-active-catalog" },
]

function runStep(name: string, cmd: string) {
  console.log(`\n[discovery:bootstrap] ▶ ${name}`)
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env })
}

async function main() {
  console.log("[discovery:bootstrap] Starting prioritized catalog + search setup…")
  for (const step of steps) {
    runStep(step.name, step.cmd)
  }
  console.log("\n[discovery:bootstrap] Done. Run: npm run check:discovery")
}

main().catch((e) => {
  console.error("[discovery:bootstrap]", e)
  process.exit(1)
})
