import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

const PRIMARY_MODEL = "stabilityai/stable-diffusion-inpainting"
const FALLBACK_MODEL = "runwayml/stable-diffusion-inpainting"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callHfModel(params: {
  token: string
  model: string
  imageBase64: string
  maskBase64: string
  prompt: string
}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://router.huggingface.co/hf-inference/models/${params.model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          image: params.imageBase64,
          mask: params.maskBase64,
          prompt: params.prompt,
        },
      }),
    })

    const contentType = res.headers.get("content-type") || ""
    if (res.ok && !contentType.includes("application/json")) {
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")
      return { ok: true as const, dataUrl: `data:image/png;base64,${base64}` }
    }

    let payload: unknown = null
    if (contentType.includes("application/json")) {
      payload = await res.json().catch(() => null)
    } else {
      payload = await res.text().catch(() => null)
    }

    const errorText =
      typeof payload === "string"
        ? payload
        : typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error?: unknown }).error)
          : `HF request failed (${res.status})`

    const estimatedSeconds =
      typeof payload === "object" && payload && "estimated_time" in payload
        ? Number((payload as { estimated_time?: unknown }).estimated_time)
        : NaN

    const modelLoading = res.status === 503 || /loading/i.test(errorText)
    if (modelLoading && attempt < 4) {
      const waitMs = Number.isFinite(estimatedSeconds) ? Math.max(1500, Math.ceil(estimatedSeconds * 1000)) : 12000
      await sleep(waitMs)
      continue
    }

    return {
      ok: false as const,
      status: res.status,
      detail: payload,
      error: errorText,
    }
  }

  return { ok: false as const, status: 500, error: "HF inference retries exhausted", detail: null as unknown }
}

export async function POST(req: NextRequest) {
  try {
    const { image, mask, prompt = "remove text, clean background" } = (await req.json()) as {
      image?: string
      mask?: string
      prompt?: string
    }
    if (!image || !mask) {
      return NextResponse.json({ error: "Missing image or mask" }, { status: 400 })
    }

    const token = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
    if (!token) {
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({
          image,
          fallback: true,
          warning: "HF token missing in dev; returning original image.",
        })
      }
      return NextResponse.json({ error: "HUGGINGFACE_API_KEY (or HF_TOKEN) missing" }, { status: 500 })
    }

    const imageBase64 = image.includes(",") ? image.split(",")[1] : image
    const maskBase64 = mask.includes(",") ? mask.split(",")[1] : mask
    if (!imageBase64 || !maskBase64) {
      return NextResponse.json({ error: "Invalid base64 image/mask payload" }, { status: 400 })
    }

    const primary = await callHfModel({ token, model: PRIMARY_MODEL, imageBase64, maskBase64, prompt })
    if (primary.ok) {
      return NextResponse.json({ image: primary.dataUrl, model: PRIMARY_MODEL })
    }
    console.error("[api/inpaint] primary model failed", primary)

    const fallback = await callHfModel({ token, model: FALLBACK_MODEL, imageBase64, maskBase64, prompt })
    if (fallback.ok) {
      return NextResponse.json({ image: fallback.dataUrl, model: FALLBACK_MODEL, fallback: true })
    }
    console.error("[api/inpaint] fallback model failed", fallback)

    // Dev-safe fallback to keep Studio UX unblocked when HF permissions/quotas fail.
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        image,
        fallback: true,
        warning: "HF inpaint unavailable in dev; returning original image.",
        primary,
        fallbackDetail: fallback,
      })
    }

    return NextResponse.json(
      {
        error: "Hugging Face inpaint failed on primary + fallback models",
        primary,
        fallback,
      },
      { status: 500 }
    )
  } catch (e: unknown) {
    console.error("[api/inpaint] unexpected error", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 })
  }
}
