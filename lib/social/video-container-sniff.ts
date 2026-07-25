/** Detect container from magic bytes — never trust MediaRecorder mime labels. */
export function sniffVideoContainer(bytes: Uint8Array): "mp4" | "webm" | "unknown" {
  if (bytes.length >= 8) {
    const brand = String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!)
    if (brand === "ftyp") return "mp4"
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "webm"
  }
  return "unknown"
}
