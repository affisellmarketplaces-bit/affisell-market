import { describe, expect, it, vi } from "vitest"

import {
  deriveZeroWaitParentSync,
  scheduleZeroWaitParentSync,
} from "@/lib/upload/zero-wait-upload-parent-sync"
import type { ZeroWaitUploadSlot } from "@/lib/upload/zero-wait-uploader"

const readySlot: ZeroWaitUploadSlot = {
  id: "1",
  fileName: "a.jpg",
  status: "ready",
  progress: 100,
  previewUrl: "blob:x",
  durableUrl: "https://cdn.example/a.jpg",
  error: null,
}

const uploadingSlot: ZeroWaitUploadSlot = {
  ...readySlot,
  id: "2",
  status: "uploading",
  progress: 40,
  durableUrl: null,
}

describe("zero-wait-upload-parent-sync", () => {
  it("derives durable URLs and busy flag from slots", () => {
    expect(deriveZeroWaitParentSync([uploadingSlot])).toEqual({
      urls: [],
      busy: true,
      processedDataUrl: null,
    })
    expect(deriveZeroWaitParentSync([readySlot])).toEqual({
      urls: ["https://cdn.example/a.jpg"],
      busy: false,
      processedDataUrl: null,
    })
  })

  it("schedules parent sync after current turn (not during setState updater)", async () => {
    const onUrlsChange = vi.fn()
    const onBusyChange = vi.fn()
    let slots = [uploadingSlot]

    scheduleZeroWaitParentSync(() => slots, { onUrlsChange, onBusyChange })
    expect(onUrlsChange).not.toHaveBeenCalled()
    expect(onBusyChange).not.toHaveBeenCalled()

    slots = [readySlot]
    await Promise.resolve()

    expect(onUrlsChange).toHaveBeenCalledWith(["https://cdn.example/a.jpg"])
    expect(onBusyChange).toHaveBeenCalledWith(false)
  })
})
