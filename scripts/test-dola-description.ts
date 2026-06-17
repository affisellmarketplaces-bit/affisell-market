/**
 * One-shot: verify BytePlus Dola via groqChatText (loads .env.local).
 * Run: npx tsx scripts/test-dola-description.ts
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
  const key = process.env.BYTEPLUS_API_KEY?.trim() ?? ""
  console.log("[test-dola-description] BYTEPLUS_API_KEY starts with ark-:", key.startsWith("ark-"))
  console.log("[test-dola-description] BYTEPLUS_BASE_URL:", process.env.BYTEPLUS_BASE_URL)
  console.log("[test-dola-description] BYTEPLUS_LLM_MODEL:", process.env.BYTEPLUS_LLM_MODEL)

  const { groqChatText } = await import("../lib/ai/groq-client")
  const text = await groqChatText({
    vision: false,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content:
          "Décris ce produit en FR vendeur: Stylo bille multifonction 4 couleurs, rechargeable",
      },
    ],
  })

  console.log("\n--- groqChatText result ---")
  console.log(text ?? "(null)")
}

main().catch((err) => {
  console.error("[test-dola-description] Fatal:", err)
  process.exit(1)
})
