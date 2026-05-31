const MAX_REFERENCE_BYTES = 12 * 1024 * 1024

export type VeoReferenceImagePayload = {
  bytesBase64Encoded: string
  mimeType: string
}

function mimeFromUrl(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes(".png")) return "image/png"
  if (lower.includes(".webp")) return "image/webp"
  if (lower.includes(".gif")) return "image/gif"
  return "image/jpeg"
}

/** Télécharge une image HTTPS publique pour conditioning Veo (image-to-video). */
export async function fetchImageAsVeoReference(url: string): Promise<VeoReferenceImagePayload> {
  const trimmed = url.trim()
  if (!trimmed.startsWith("https://")) {
    throw new Error("Reference image must be an HTTPS URL")
  }

  const res = await fetch(trimmed, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Failed to fetch reference image (${res.status})`)
  }

  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim()
  const mimeType =
    contentType && contentType.startsWith("image/") ? contentType : mimeFromUrl(trimmed)

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) {
    throw new Error("Reference image is empty")
  }
  if (buf.length > MAX_REFERENCE_BYTES) {
    throw new Error("Reference image must be under 12 MB")
  }

  return {
    bytesBase64Encoded: buf.toString("base64"),
    mimeType,
  }
}

export function buildVideoPromptWithReferences(
  productName: string,
  style: string,
  refs: { imageUrls: string[]; videoUrls: string[] }
): string {
  const base = `${style.trim()} product video ad for ${productName.trim()}, vertical 9:16, 4 seconds, cinematic lighting, photorealistic, no watermark text.`

  const parts: string[] = [base]
  if (refs.imageUrls.length > 0) {
    parts.push(
      "Match the exact product shape, colors, materials, branding and proportions shown in the supplier reference photos — realistic commercial render."
    )
  }
  if (refs.videoUrls.length > 0) {
    parts.push(
      "Match the camera motion, pacing and product showcase style suggested by the supplier reference video."
    )
  }
  return parts.join(" ")
}
