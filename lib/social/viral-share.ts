/**
 * Native share sheet (WhatsApp / Files / Messages) with download fallback.
 * Browser-only — never import from server components.
 */

export type ShareFileResult = "shared" | "downloaded" | "cancelled"

function canShareFiles(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false
  if (typeof navigator.canShare !== "function") return true
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function shareOrDownloadFile(opts: {
  blob: Blob
  filename: string
  title: string
  text?: string
  mimeType?: string
}): Promise<ShareFileResult> {
  const mime = opts.mimeType || opts.blob.type || "application/octet-stream"
  const file = new File([opts.blob], opts.filename, { type: mime })

  if (canShareFiles(file)) {
    try {
      await navigator.share({
        files: [file],
        title: opts.title,
        text: opts.text,
      })
      return "shared"
    } catch (err) {
      const name = err instanceof Error ? err.name : ""
      if (name === "AbortError") return "cancelled"
      console.log("[viral-share]", { result: "share_failed_fallback_download", name })
    }
  }

  triggerDownload(opts.blob, opts.filename)
  return "downloaded"
}

export async function copyTextReliable(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.log("[viral-share]", {
      result: "clipboard_failed",
      error: err instanceof Error ? err.message : "clipboard_failed",
    })
    return false
  }
}
