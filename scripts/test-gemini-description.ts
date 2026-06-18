/**
 * One-shot: verify Gemini 3.5 Flash (loads .env.local).
 * Run: npx tsx scripts/test-gemini-description.ts
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let value = t.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnvFile(resolve(process.cwd(), ".env.local"))
loadDotEnvFile(resolve(process.cwd(), ".env"))

async function main() {
  const key = process.env.GEMINI_API_KEY?.trim() ?? ""
  console.log("[test-gemini-description] GEMINI_API_KEY starts with AIza:", key.startsWith("AIza"))
  console.log("[test-gemini-description] GEMINI_MODEL:", process.env.GEMINI_MODEL)

  const { geminiChatText } = await import("../lib/ai/gemini-client")
  const text = await geminiChatText("Décris un stylo 4 couleurs en 1 phrase")

  console.log("\n--- geminiChatText result ---")
  console.log(text)
}

main().catch((err) => {
  console.error("[test-gemini-description] Fatal:", err)
  process.exit(1)
})
