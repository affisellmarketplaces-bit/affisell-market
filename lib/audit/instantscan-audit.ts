/**
 * InstantScan diagnostic — run: npx tsx lib/audit/instantscan-audit.ts
 * Or: npm run audit:instantscan
 */
import fs from "fs"
import path from "path"

const root = process.cwd()

function exists(rel: string): boolean {
  return fs.existsSync(path.join(root, rel))
}

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

console.log("=== INSTANTSCAN AUDIT ===")

const routes = [
  "app/api/instantscan/route.ts",
  "app/api/wizard/instantscan/route.ts",
  "app/api/products/instantscan/route.ts",
  "app/api/ai/analyze-product/route.ts",
  "lib/ai/instantscan.ts",
  "lib/ai/instantscan-client.ts",
  "lib/ai/product-analyzer.ts",
  "lib/ai/product-vision-v2-config.ts",
  "lib/ai/product-vision-v2-parse.ts",
  "lib/ai/vision-image-url.ts",
  "lib/vision/instantscan.ts",
]
routes.forEach((r) => {
  console.log(`${exists(r) ? "✅" : "❌"} ${r}`)
})

const libAi = exists("lib/ai") ? fs.readdirSync(path.join(root, "lib/ai")).sort() : []
console.log("lib/ai files:", libAi.join(", "))

const envExample = exists(".env.example") ? read(".env.example") : ""
const envLocalExample = exists(".env.local.example") ? read(".env.local.example") : ""
const envBlob = `${envExample}\n${envLocalExample}`
const required = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_VISION_API_KEY",
  "REPLICATE_API_KEY",
  "ENABLE_INSTANTSCAN",
  "AI_VISION_V2_CONFIDENCE_THRESHOLD",
  "PRODUCT_VISION_V2_MODEL",
]
required.forEach((k) => {
  console.log(`${envBlob.includes(k) ? "✅" : "❌"} ${k} in .env.example / .env.local.example`)
})

const wizardPaths = [
  "components/wizard/WizardV2.tsx",
  "components/wizard/InstantScanStep.tsx",
  "components/supplier/wizard-v2/supplier-product-wizard-v2.tsx",
  "components/supplier/wizard-v2/wizard-v2-zero-wait-upload.tsx",
  "app/dashboard/fournisseur/publier/page.tsx",
  "app/dashboard/supplier/publish/page.tsx",
  "app/dashboard/supplier/products/new/page.tsx",
]
wizardPaths.forEach((p) => console.log(`${exists(p) ? "✅" : "❌"} ${p}`))

const mainCandidates = [
  "app/api/ai/analyze-product/route.ts",
  "lib/ai/product-analyzer.ts",
  "lib/ai/product-vision-v2-config.ts",
]
const mainFile = mainCandidates.find((r) => exists(r))
if (mainFile) {
  const content = read(mainFile)
  console.log(`\n--- Contenu ${mainFile} (1000 premiers chars) ---`)
  console.log(content.slice(0, 1000))

  console.log("\n--- CHECKS CRITIQUES ---")
  console.log(`Contient openai? ${/openai/i.test(content)}`)
  console.log(`Contient vision? ${/vision/i.test(content)}`)
  console.log(`Contient gpt-4o? ${content.includes("gpt-4o")}`)
  console.log(`Contient claude? ${/claude/i.test(content)}`)
  console.log(`Gestion erreur "incertain"? ${/incertain|low_confidence/i.test(content)}`)
  console.log(`Fallback manuel? ${/manual|Saisie manuelle|fallback/i.test(content)}`)
}

const configPath = "lib/ai/product-vision-v2-config.ts"
if (exists(configPath)) {
  const cfg = read(configPath)
  const thresholdMatch = cfg.match(/AI_VISION_V2_CONFIDENCE_THRESHOLD \?\? "([^"]+)"/)
  console.log("\n--- THRESHOLD DEFAULT ---")
  console.log(`Default in code: ${thresholdMatch?.[1] ?? "unknown"}`)
  console.log(`.env.example value line:`)
  for (const line of envExample.split("\n")) {
    if (line.includes("AI_VISION_V2_CONFIDENCE_THRESHOLD")) console.log(`  ${line}`)
  }
}

const hasLocalEnv = exists(".env.local")
console.log("\n--- LOCAL ENV ---")
console.log(`.env.local present: ${hasLocalEnv ? "✅" : "❌"}`)
if (hasLocalEnv) {
  const local = read(".env.local")
  const hasOpenAi = /^OPENAI_API_KEY=.+/m.test(local) && !/^OPENAI_API_KEY=\s*$/m.test(local)
  const openAiEmpty = /^OPENAI_API_KEY=(""|)\s*$/m.test(local)
  console.log(`OPENAI_API_KEY set (non-empty): ${hasOpenAi && !openAiEmpty ? "✅" : "❌"}`)
  const thr = local.match(/^AI_VISION_V2_CONFIDENCE_THRESHOLD=(.+)$/m)
  console.log(`AI_VISION_V2_CONFIDENCE_THRESHOLD: ${thr?.[1]?.trim() ?? "(unset → code default)"}`)
  const en = local.match(/^ENABLE_INSTANTSCAN=(.+)$/m)
  console.log(`ENABLE_INSTANTSCAN: ${en?.[1]?.trim() ?? "(unset)"}`)
}

console.log("\n=== AUDIT DONE ===")
console.log("Primary InstantScan API: POST /api/ai/analyze-product")
console.log("Wizard UI: components/supplier/wizard-v2/supplier-product-wizard-v2.tsx")
