/**
 * `data:` URL → Blob WITHOUT a network request.
 *
 * `fetch(dataUrl)` is a `connect-src` request for the Content-Security-Policy: it is reported today (policy in Report-Only,
 * see lib/security-headers.ts) and would simply fail the day that policy is enforced — silently breaking every photo upload.
 * Decoding in memory has the same result and never touches the policy. Client-safe.
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^,;]*)((?:;[^,;]*)*),([\s\S]*)$/.exec(dataUrl.trim())
  if (!m) return null
  const mime = m[1]?.trim() || "text/plain"
  const isBase64 = /;base64/i.test(m[2] ?? "")
  const payload = m[3] ?? ""
  try {
    if (!isBase64) return new Blob([decodeURIComponent(payload)], { type: mime })
    const binary = atob(payload.replace(/\s+/g, ""))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

/** The blob of a processed image URL: decoded in memory for `data:` URLs, fetched otherwise (e.g. `blob:`). */
export async function imageUrlToBlob(url: string): Promise<Blob> {
  return dataUrlToBlob(url) ?? (await (await fetch(url)).blob())
}
