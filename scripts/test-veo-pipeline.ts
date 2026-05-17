/**
 * Full Veo pipeline: predict → poll (90s) → Blob upload.
 * Run: npx tsx scripts/test-veo-pipeline.ts
 */
import "dotenv/config"
import { config } from "dotenv"

config({ path: ".env.local", override: true })

import { generateVeoProductVideo } from "../lib/veo-video"

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.error("Set BLOB_READ_WRITE_TOKEN in .env.local")
    process.exit(1)
  }

  const started = Date.now()
  const result = await generateVeoProductVideo({
    productId: "test-product",
    userPrompt: "iPhone product showcase, sleek studio lighting, premium tech ad",
    format: "9:16",
    product: {
      name: "iPhone 15 Pro",
      description: "Latest Apple smartphone with titanium design.",
      attributes: [{ label: "Storage", value: "256GB" }],
    },
    pollTimeoutMs: 90_000,
  })

  console.log("✅ Pipeline OK", {
    jobId: result.jobId,
    videoUrl: result.videoUrl,
    elapsedSec: Math.round((Date.now() - started) / 1000),
  })
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
