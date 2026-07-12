import type { ZeroWaitUploadSlot } from "@/lib/upload/zero-wait-uploader"

export function deriveZeroWaitParentSync(slots: ZeroWaitUploadSlot[]): {
  urls: string[]
  busy: boolean
  processedDataUrl: string | null
} {
  const urls = slots.map((s) => s.durableUrl).filter((u): u is string => Boolean(u))
  const busy = slots.some((s) => s.status === "processing" || s.status === "uploading")
  const processedDataUrl =
    [...slots].reverse().find((s) => s.processedDataUrl?.startsWith("data:image/"))?.processedDataUrl ??
    null
  return { urls, busy, processedDataUrl }
}

/** Notify parent after React commits slot state — never call from inside a setState updater. */
export function scheduleZeroWaitParentSync(
  readSlots: () => ZeroWaitUploadSlot[],
  callbacks: {
    onUrlsChange: (urls: string[]) => void
    onBusyChange?: (busy: boolean) => void
    onProcessedDataUrl?: (dataUrl: string | null) => void
  }
): void {
  queueMicrotask(() => {
    const { urls, busy, processedDataUrl } = deriveZeroWaitParentSync(readSlots())
    // Data URL first — wizard keeps JPEG backup before CDN URL triggers analyze
    callbacks.onProcessedDataUrl?.(processedDataUrl)
    callbacks.onUrlsChange(urls)
    callbacks.onBusyChange?.(busy)
  })
}
