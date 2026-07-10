import type { ZeroWaitUploadSlot } from "@/lib/upload/zero-wait-uploader"

export function deriveZeroWaitParentSync(slots: ZeroWaitUploadSlot[]): {
  urls: string[]
  busy: boolean
} {
  const urls = slots.map((s) => s.durableUrl).filter((u): u is string => Boolean(u))
  const busy = slots.some((s) => s.status === "processing" || s.status === "uploading")
  return { urls, busy }
}

/** Notify parent after React commits slot state — never call from inside a setState updater. */
export function scheduleZeroWaitParentSync(
  readSlots: () => ZeroWaitUploadSlot[],
  callbacks: {
    onUrlsChange: (urls: string[]) => void
    onBusyChange?: (busy: boolean) => void
  }
): void {
  queueMicrotask(() => {
    const { urls, busy } = deriveZeroWaitParentSync(readSlots())
    callbacks.onUrlsChange(urls)
    callbacks.onBusyChange?.(busy)
  })
}
