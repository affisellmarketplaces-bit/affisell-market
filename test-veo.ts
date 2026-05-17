/**
 * Validate Veo + Vertex service account auth.
 * Run: npx tsx test-veo.ts
 */
import "dotenv/config"

import { config } from "dotenv"

config({ path: ".env.local", override: true })

import { VeoHttpError, getVeoConfig, veoPredictLongRunning } from "./lib/veo-video"

function explainHttp(status: number, body: unknown): void {
  const err =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: { message?: string; details?: unknown[] } }).error
      : undefined
  const detail = err?.message ?? ""
  const reasons =
    Array.isArray(err?.details) &&
    err.details
      .map((d) =>
        d && typeof d === "object" && "reason" in d ? String((d as { reason?: string }).reason) : ""
      )
      .filter(Boolean)
      .join(", ")

  if (status === 401) {
    console.error("401 Unauthorized — service account token rejected.")
    console.error("  Check GOOGLE_APPLICATION_CREDENTIALS_JSON / gcp-service-account.json")
    console.error("  and Vertex AI User on project", process.env.GOOGLE_CLOUD_PROJECT)
  } else if (status === 403) {
    console.error("403 Forbidden — enable Vertex AI API and grant Vertex AI User on the project.")
  } else if (status === 404) {
    console.error("404 Not Found — check GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, VEO_MODEL_ID.")
  } else {
    console.error(`HTTP ${status}`)
  }
  if (detail) console.error("  message:", detail)
  if (reasons) console.error("  reasons:", reasons)
}

async function main() {
  const veoConfig = getVeoConfig()
  const body = {
    instances: [{ prompt: "test cat walking in a studio, product ad style" }],
    parameters: { durationSeconds: 4, aspectRatio: "9:16", sampleCount: 1 },
  }

  console.log("Config:", {
    project: veoConfig.project,
    location: veoConfig.location,
    modelId: veoConfig.modelId,
    auth: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
      ? "GOOGLE_APPLICATION_CREDENTIALS_JSON"
      : process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? "GOOGLE_APPLICATION_CREDENTIALS"
        : "gcp-service-account.json (ADC)",
  })

  try {
    const { operationName, raw } = await veoPredictLongRunning(veoConfig, body)
    console.log("✅ VEO OK")
    console.log("operation.name:", operationName)
    if (raw && typeof raw === "object") {
      const keys = Object.keys(raw as object).filter((k) => k !== "metadata")
      console.log("response keys:", keys.join(", ") || "(none)")
    }
  } catch (e) {
    if (e instanceof VeoHttpError) {
      console.error("\n--- predictLongRunning failed ---")
      explainHttp(e.status, e.body)
      process.exit(1)
    }
    throw e
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
