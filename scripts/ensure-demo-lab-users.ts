/**
 * Idempotent Demo Lab user + catalog seed.
 * Usage: DEMO_LAB_ENABLED=1 DEMO_LAB_PASSWORD=… npx tsx scripts/ensure-demo-lab-users.ts
 */
import { isDemoLabEnabled } from "@/lib/demo/demo-accounts-config"
import { ensureAllDemoLabUsers } from "@/lib/demo/ensure-demo-users"

async function main() {
  if (!isDemoLabEnabled()) {
    console.error("[demo-lab-ensure]", { result: "skipped", reason: "DEMO_LAB_ENABLED not set" })
    process.exit(1)
  }
  await ensureAllDemoLabUsers()
  console.log("[demo-lab-ensure]", { result: "all_ok" })
}

main().catch((error) => {
  console.error("[demo-lab-ensure]", { result: "fatal", error })
  process.exit(1)
})
