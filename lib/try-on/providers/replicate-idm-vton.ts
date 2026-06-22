import "server-only"

import Replicate from "replicate"

import type {
  TryOnProvider,
  TryOnProviderInput,
  TryOnProviderPollResult,
  TryOnProviderStartResult,
} from "@/lib/try-on/provider-types"

const MODEL_OWNER = "yisol"
const MODEL_NAME = "idm-vton"
const DEFAULT_VERSION =
  process.env.REPLICATE_IDM_VTON_VERSION?.trim() ||
  "05196281db426529e2c1fb0684570fc728bd5a3639aa482d0aee669aeffa1485"

function getReplicateClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not configured")
  }
  return new Replicate({ auth: token })
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === "string" && item.startsWith("http")) return item
    }
  }
  return null
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        const delayMs = 400 * 2 ** i
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export const replicateIdmVtonProvider: TryOnProvider = {
  modelVersion: "idm-vton",

  async startPrediction(input: TryOnProviderInput, webhookUrl: string): Promise<TryOnProviderStartResult> {
    const replicate = getReplicateClient()
    const garmentDes =
      input.angle === "front"
        ? input.garmentDescription || "front of garment"
        : input.garmentDescription

    const prediction = await withRetry(async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15_000)
      try {
        return await replicate.predictions.create({
          version: DEFAULT_VERSION,
          input: {
            garm_img: input.garmentImageUrl,
            human_img: input.humanImageUrl,
            garment_des: garmentDes,
            is_checked: true,
            is_checked_crop: false,
            denoise_steps: 30,
          },
          webhook: webhookUrl,
          webhook_events_filter: ["completed"],
        })
      } finally {
        clearTimeout(timer)
      }
    })

    if (!prediction.id) {
      throw new Error("Replicate did not return a prediction id")
    }

    console.log("[try-on]", {
      result: "replicate_started",
      predictionId: prediction.id,
      model: MODEL_NAME,
    })

    return {
      externalJobId: prediction.id,
      modelVersion: `${MODEL_OWNER}/${MODEL_NAME}`,
    }
  },

  async fetchPrediction(externalJobId: string): Promise<TryOnProviderPollResult> {
    const replicate = getReplicateClient()
    const prediction = await replicate.predictions.get(externalJobId)
    const status = prediction.status

    if (status === "starting" || status === "processing") {
      return { status: "processing" }
    }

    if (status === "succeeded") {
      const url = extractOutputUrl(prediction.output)
      if (!url) {
        return { status: "failed", error: "Replicate succeeded but returned no image URL" }
      }
      const started = prediction.started_at ? Date.parse(prediction.started_at) : NaN
      const completed = prediction.completed_at ? Date.parse(prediction.completed_at) : NaN
      const latencyMs =
        Number.isFinite(started) && Number.isFinite(completed) ? completed - started : undefined
      return { status: "done", outputUrl: url, latencyMs }
    }

    if (status === "failed" || status === "canceled") {
      const err =
        typeof prediction.error === "string"
          ? prediction.error
          : "Try-on generation failed"
      return { status: "failed", error: err }
    }

    return { status: "processing" }
  },
}
