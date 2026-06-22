import type { TryOnJobResponse } from "@/lib/try-on/try-on-shared"
import { TRYON_CONSENT_VERSION } from "@/lib/try-on/try-on-shared"

function tryOnQuerySuffix(): string {
  if (typeof window === "undefined") return ""
  const params = new URLSearchParams(window.location.search)
  const v = params.get("tryon")
  return v === "true" || v === "1" ? "?tryon=true" : ""
}

export async function uploadTryOnPhoto(file: Blob): Promise<{ inputUrl: string }> {
  const form = new FormData()
  form.append("file", file, "tryon.jpg")
  const res = await fetch(`/api/try-on/upload${tryOnQuerySuffix()}`, {
    method: "POST",
    body: form,
  })
  const data = (await res.json()) as { inputUrl?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? "Upload failed")
  }
  if (!data.inputUrl) {
    throw new Error("Upload did not return a URL")
  }
  return { inputUrl: data.inputUrl }
}

export async function startTryOnJob(input: {
  productId: string
  affiliateProductId?: string
  inputUrl: string
}): Promise<TryOnJobResponse> {
  const res = await fetch(`/api/try-on${tryOnQuerySuffix()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      productId: input.productId,
      affiliateProductId: input.affiliateProductId,
      inputUrl: input.inputUrl,
      angle: "front",
      gdprConsent: true,
      consentVersion: TRYON_CONSENT_VERSION,
    }),
  })
  const data = (await res.json()) as TryOnJobResponse & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? "Try-on failed")
  }
  return data
}

export async function pollTryOnJob(jobId: string): Promise<TryOnJobResponse> {
  const flag = tryOnQuerySuffix()
  const qs = flag ? `${flag}&jobId=${encodeURIComponent(jobId)}` : `?jobId=${encodeURIComponent(jobId)}`
  const res = await fetch(`/api/try-on${qs}`, { credentials: "include" })
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
