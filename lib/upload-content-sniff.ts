/**
 * Magic-byte sniff for uploads — never trust client `File.type` alone.
 * Client-safe Buffer helpers (Node Buffer available in API routes).
 */

export type SniffedUploadKind = "jpeg" | "png" | "webp" | "gif" | "pdf" | "mp4" | "webm"

export type SniffedUpload = {
  kind: SniffedUploadKind
  mime: string
}

const KIND_MIME: Record<SniffedUploadKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
}

function startsWithBytes(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false
  return sig.every((b, i) => buf[i] === b)
}

function looksLikeSvgOrHtml(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 256)).toString("utf8").trimStart().toLowerCase()
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return true
  if (head.startsWith("<?xml") && head.includes("<svg")) return true
  if (head.startsWith("<svg")) return true
  return false
}

/** Detect real file kind from leading bytes. Returns null if unknown / dangerous. */
export function sniffUploadBytes(input: Buffer | Uint8Array): SniffedUpload | null {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  if (buf.length < 12) return null
  if (looksLikeSvgOrHtml(buf)) return null

  if (startsWithBytes(buf, [0xff, 0xd8, 0xff])) {
    return { kind: "jpeg", mime: KIND_MIME.jpeg }
  }
  if (startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "png", mime: KIND_MIME.png }
  }
  if (startsWithBytes(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWithBytes(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
    return { kind: "gif", mime: KIND_MIME.gif }
  }
  // RIFF....WEBP
  if (
    startsWithBytes(buf, [0x52, 0x49, 0x46, 0x46]) &&
    buf.length >= 12 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { kind: "webp", mime: KIND_MIME.webp }
  }
  if (startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46])) {
    return { kind: "pdf", mime: KIND_MIME.pdf }
  }
  // ISO BMFF — ....ftyp
  if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return { kind: "mp4", mime: KIND_MIME.mp4 }
  }
  // EBML / WebM
  if (startsWithBytes(buf, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: "webm", mime: KIND_MIME.webm }
  }

  return null
}

export function isImageSniff(kind: SniffedUploadKind): boolean {
  return kind === "jpeg" || kind === "png" || kind === "webp" || kind === "gif"
}

export function isVideoSniff(kind: SniffedUploadKind): boolean {
  return kind === "mp4" || kind === "webm"
}

export function isPdfSniff(kind: SniffedUploadKind): boolean {
  return kind === "pdf"
}
