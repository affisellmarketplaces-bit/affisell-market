/**
 * Full Veo pipeline: predict → poll (90s) → Blob upload.
 * Run: npx tsx scripts/test-veo-pipeline.ts
 */
import "dotenv/config"
import { config } from "dotenv"

config({ path: ".env.local", override: true })

import { getVeoAuthSource } from "../lib/veo-auth"
import { uploadVideoToVercelBlob } from "../lib/video-storage"
import {
  downloadGcsUri,
  extractVideoBytesFromVeoResponse,
  formatToVeoAspectRatio,
  getVeoConfig,
  pollVeoOperation,
  resolveVeoDurationSeconds,
  veoPredictLongRunning,
} from "../lib/veo-video"

const PROMPT =
  "A ginger cat wearing a beret dancing in Paris street, 4k, cinematic, no phone, no product"

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.error("Set BLOB_READ_WRITE_TOKEN in .env.local")
    process.exit(1)
  }

  console.log("Auth:", getVeoAuthSource())
  console.log("Prompt:", PROMPT)

  const config = getVeoConfig()
  const format = "9:16" as const
  const started = Date.now()

  const { operationName } = await veoPredictLongRunning(config, {
    instances: [{ prompt: PROMPT }],
    parameters: {
      aspectRatio: formatToVeoAspectRatio(format),
      durationSeconds: resolveVeoDurationSeconds(format),
      sampleCount: 1,
      generateAudio: false,
    },
  })

  const donePayload = await pollVeoOperation(operationName, { timeoutMs: 90_000, intervalMs: 3_000 })

  let { bytes, gcsUri } = extractVideoBytesFromVeoResponse(donePayload)
  if (bytes.length === 0 && gcsUri) {
    bytes = await downloadGcsUri(gcsUri)
  }

  const operationId = operationName.split("/").pop() ?? operationName
  const videoUrl = await uploadVideoToVercelBlob(bytes, operationId)

  console.log("✅ Pipeline OK", {
    jobId: operationId,
    videoUrl,
    elapsedSec: Math.round((Date.now() - started) / 1000),
  })
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
