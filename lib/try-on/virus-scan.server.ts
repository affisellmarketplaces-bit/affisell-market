import "server-only"

const BLOCKED_SIGNATURES: Array<{ name: string; bytes: number[] }> = [
  { name: "exe", bytes: [0x4d, 0x5a] },
  { name: "elf", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
]

function startsWithBytes(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false
  return sig.every((b, i) => buf[i] === b)
}

/**
 * Lightweight upload guard. Full ClamAV WASM can be wired when `TRY_ON_CLAMAV_WASM=1`.
 * Rejects obvious non-image payloads before blob storage.
 */
export async function scanTryOnUpload(bytes: Buffer, mimeType: string): Promise<{ safe: true } | { safe: false; reason: string }> {
  if (bytes.length < 32) {
    return { safe: false, reason: "File too small" }
  }
  if (bytes.length > 8 * 1024 * 1024) {
    return { safe: false, reason: "File exceeds 8MB limit" }
  }

  for (const sig of BLOCKED_SIGNATURES) {
    if (startsWithBytes(bytes, sig.bytes)) {
      return { safe: false, reason: `Blocked file type (${sig.name})` }
    }
  }

  const allowed = mimeType.startsWith("image/")
  if (!allowed) {
    return { safe: false, reason: "Only image uploads are allowed" }
  }

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45
  if (!isJpeg && !isPng && !isWebp) {
    return { safe: false, reason: "Unrecognized image format" }
  }

  if (process.env.TRY_ON_CLAMAV_WASM === "1") {
    console.log("[try-on]", { result: "clamav_wasm_skipped", note: "hook reserved for WASM module" })
  }

  return { safe: true }
}
