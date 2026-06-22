import "server-only"

import Replicate from "replicate"

export type ModerationResult = { safe: true } | { safe: false; reason: string }

async function moderateWithReplicateNsfw(imageUrl: string): Promise<ModerationResult> {
  const token = process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) {
    console.warn("[try-on]", { result: "moderation_skipped", reason: "no_replicate_token" })
    return { safe: true }
  }

  const replicate = new Replicate({ auth: token })
  const version =
    process.env.REPLICATE_NSFW_VERSION?.trim() ||
    "777a871e222011d8b85a923c116f7897a888ae5886a55e5239f2dad1432e338"

  try {
    const prediction = await replicate.predictions.create({
      version,
      input: { image: imageUrl },
    })
    const id = prediction.id
    if (!id) return { safe: true }

    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      const row = await replicate.predictions.get(id)
      if (row.status === "succeeded") {
        const out = row.output as { nsfw?: boolean; score?: number } | boolean | null
        if (typeof out === "boolean" && out) {
          return { safe: false, reason: "Image flagged as unsafe" }
        }
        if (out && typeof out === "object") {
          if (out.nsfw === true) {
            return { safe: false, reason: "Image flagged as unsafe" }
          }
          if (typeof out.score === "number" && out.score > 0.85) {
            return { safe: false, reason: "Image flagged as unsafe" }
          }
        }
        return { safe: true }
      }
      if (row.status === "failed" || row.status === "canceled") break
      await new Promise((r) => setTimeout(r, 400))
    }
  } catch (err) {
    console.warn("[try-on]", {
      result: "moderation_error",
      message: err instanceof Error ? err.message : String(err),
    })
  }

  return { safe: true }
}

async function moderateWithAzure(imageUrl: string): Promise<ModerationResult> {
  const endpoint = process.env.AZURE_CONTENT_SAFETY_ENDPOINT?.trim()
  const key = process.env.AZURE_CONTENT_SAFETY_KEY?.trim()
  if (!endpoint || !key) {
    return moderateWithReplicateNsfw(imageUrl)
  }

  try {
    const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(8_000) })
    if (!imageRes.ok) return { safe: false, reason: "Could not fetch image for moderation" }
    const bytes = Buffer.from(await imageRes.arrayBuffer())
    const base64 = bytes.toString("base64")

    const res = await fetch(`${endpoint.replace(/\/$/, "")}/contentsafety/image:analyze?api-version=2024-02-15-preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": key,
      },
      body: JSON.stringify({
        image: { content: base64 },
        categories: ["Sexual", "Violence", "Hate", "SelfHarm"],
      }),
      signal: AbortSignal.timeout(8_000),
    })

    if (!res.ok) {
      console.warn("[try-on]", { result: "azure_moderation_http", status: res.status })
      return moderateWithReplicateNsfw(imageUrl)
    }

    const data = (await res.json()) as {
      categoriesAnalysis?: Array<{ category?: string; severity?: number }>
    }
    for (const row of data.categoriesAnalysis ?? []) {
      if ((row.severity ?? 0) >= 4) {
        return { safe: false, reason: `Content safety: ${row.category ?? "unsafe"}` }
      }
    }
    return { safe: true }
  } catch (err) {
    console.warn("[try-on]", {
      result: "azure_moderation_error",
      message: err instanceof Error ? err.message : String(err),
    })
    return moderateWithReplicateNsfw(imageUrl)
  }
}

export async function moderateTryOnUserImage(imageUrl: string): Promise<ModerationResult> {
  return moderateWithAzure(imageUrl)
}
