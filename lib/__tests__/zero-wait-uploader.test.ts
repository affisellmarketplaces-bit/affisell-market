import { describe, expect, it } from "vitest"

import {
  canPublishWithUploads,
  computeRetryBackoffMs,
  publishBlockedUploadMessage,
  splitBlobIntoChunks,
  ZERO_WAIT_CHUNK_BYTES,
} from "@/lib/upload/zero-wait-uploader"

describe("zero-wait-uploader", () => {
  it("splits blob into 512KB chunks", () => {
    const blob = new Blob([new Uint8Array(ZERO_WAIT_CHUNK_BYTES + 100)])
    const chunks = splitBlobIntoChunks(blob)
    expect(chunks.length).toBe(2)
  })

  it("exponential backoff grows", () => {
    expect(computeRetryBackoffMs(0)).toBe(400)
    expect(computeRetryBackoffMs(2)).toBe(1600)
  })

  it("blocks publish until all uploads ready", () => {
    const pending = [
      {
        id: "1",
        fileName: "a.jpg",
        status: "uploading" as const,
        progress: 50,
        previewUrl: "blob:x",
        durableUrl: null,
        error: null,
      },
    ]
    expect(canPublishWithUploads(pending)).toBe(false)
    expect(publishBlockedUploadMessage(pending)).toMatch(/Upload en cours/)
  })

  it("allows publish when durable URLs ready", () => {
    const ready = [
      {
        id: "1",
        fileName: "a.jpg",
        status: "ready" as const,
        progress: 100,
        previewUrl: "blob:x",
        durableUrl: "https://cdn.example/a.jpg",
        error: null,
      },
    ]
    expect(canPublishWithUploads(ready)).toBe(true)
    expect(publishBlockedUploadMessage(ready)).toBeNull()
  })
})
