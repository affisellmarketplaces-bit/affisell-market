import { runExpansionPilot } from "@/lib/admin/expansion-pilot"

const notify = !process.argv.includes("--no-notify")
const countryArg = process.argv.find((arg) => arg.startsWith("--country="))
const countryIso2 = countryArg?.slice("--country=".length)

async function main() {
  const result = await runExpansionPilot({ notify, countryIso2 })
  if (!result.ok) {
    console.error("[expansion-pilot]", { result: "failed", error: result.error, detail: result.detail })
    process.exit(1)
  }

  console.log("[expansion-pilot]", {
    result: "success",
    country: result.countryIso2,
    countryLabel: result.countryLabel,
    waitlistCount: result.waitlistCount,
    notify: result.notify,
  })
}

main().catch((error: unknown) => {
  console.error("[expansion-pilot]", {
    result: "error",
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
