import type { TryOnJobResponse } from "@/lib/try-on/try-on-shared"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function uploadTryOnPhoto(file: Blob): Promise<{ inputUrl: string }> {
  const form = new FormData()
  form.append("selfie", file, "selfie.jpg")
  return { inputUrl: "multipart-direct" }
}

export async function startTryOnJob(input: {
  productId: string
  affiliateProductId?: string
  inputUrl: string
  selfieFile?: Blob | File | null
  garmentUrl?: string | null
}): Promise<TryOnJobResponse & { prediction_id?: string }> {
  const form = new FormData()

  if (input.selfieFile) {
    form.append("selfie", input.selfieFile, "selfie.jpg")
  } else if (input.inputUrl && input.inputUrl !== "multipart-direct") {
    const res = await fetch(input.inputUrl)
    const blob = await res.blob()
    form.append("selfie", blob, "selfie.jpg")
  } else {
    throw new Error("selfie file is required")
  }

  if (!input.garmentUrl?.trim()) {
    throw new Error("garmentUrl is required")
  }
  form.append("garment_url", input.garmentUrl.trim())

  const max429Retries = 2
  let attempt = 0

  while (true) {
    const res = await fetch("/api/try-on", {
      method: "POST",
      credentials: "include",
      body: form,
    })

    const data = (await res.json()) as TryOnJobResponse & {
      prediction_id?: string
      error?: string
    }

    if (res.status === 429 && attempt < max429Retries) {
      const retryAfterSec = Math.max(
        1,
        parseInt(res.headers.get("Retry-After") ?? "8", 10) || 8
      )
      attempt += 1
      await sleep(retryAfterSec * 1000)
      continue
    }

    if (!res.ok) {
      throw new Error(data.error ?? "Try-on failed")
    }

    return {
      jobId: data.jobId ?? "",
      status: (data.status as TryOnJobResponse["status"]) ?? "processing",
      prediction_id: data.prediction_id,
    }
  }
}

export async function pollTryOnJob(jobId: string): Promise<TryOnJobResponse> {
  const res = await fetch(`/api/try-on?jobId=${encodeURIComponent(jobId)}`, {
    credentials: "include",
  })
  const data = (await res.json()) as TryOnJobResponse & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? "Status check failed")
  }
  return data
}

export async function waitForTryOnResult(
  jobId: string,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<TryOnJobResponse> {
  const timeoutMs = opts?.timeoutMs ?? 45_000
  const intervalMs = opts?.intervalMs ?? 1_200
  const deadline = Date.now() + timeoutMs
  let last: TryOnJobResponse = { jobId, status: "pending" }

  while (Date.now() < deadline) {
    last = await pollTryOnJob(jobId)
    if (last.status === "done" || last.status === "failed") {
      return last
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return last
}
