import { isImageSniff, sniffUploadBytes } from "@/lib/upload-content-sniff"

/**
 * Photo sent to the public shopping assistant ("find me something like this"). Anyone can call it, so the image is
 * judged on its BYTES, never on the `Content-Type` / data-URL prefix the caller wrote, and it is capped.
 */

/** Largest image accepted once decoded. */
export const AGENT_VISION_MAX_BYTES = 4 * 1024 * 1024
/** Largest request body worth parsing at all (multipart framing and base64 overhead included). */
export const AGENT_VISION_MAX_REQUEST_BYTES = 6 * 1024 * 1024

const DATA_IMAGE_URL = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/i

export type AgentVisionImage =
  | { ok: true; dataUrl: string }
  | { ok: false; status: 400 | 413; error: string }

export function agentVisionImageFromBytes(bytes: Buffer): AgentVisionImage {
  if (bytes.length > AGENT_VISION_MAX_BYTES) {
    return { ok: false, status: 413, error: "Image too large (4 MB maximum)." }
  }
  const sniffed = sniffUploadBytes(bytes)
  if (!sniffed || !isImageSniff(sniffed.kind)) {
    return { ok: false, status: 400, error: "Invalid image payload." }
  }
  // the data URL carries the MIME type the bytes really have
  return { ok: true, dataUrl: `data:${sniffed.mime};base64,${bytes.toString("base64")}` }
}

export function agentVisionImageFromDataUrl(raw: string): AgentVisionImage {
  const text = raw.trim()
  // refuse on the string length BEFORE decoding or running a regex over megabytes
  if (text.length > Math.ceil((AGENT_VISION_MAX_BYTES * 4) / 3) + 64) {
    return { ok: false, status: 413, error: "Image too large (4 MB maximum)." }
  }
  const match = DATA_IMAGE_URL.exec(text)
  if (!match) return { ok: false, status: 400, error: "Invalid image payload." }
  return agentVisionImageFromBytes(Buffer.from(match[1]!, "base64"))
}
