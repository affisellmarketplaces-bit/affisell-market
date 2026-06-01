import { afterEach, describe, expect, it, vi } from "vitest"

import {
  extensionForSupplierFile,
  normalizeSupplierMediaFilename,
} from "@/lib/supplier-media-storage.server"

describe("supplier media helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("normalizes filenames", () => {
    expect(normalizeSupplierMediaFilename("Ma Vidéo #1.mp4")).toBe("Ma-Vid-o-1")
  })

  it("picks video extension from mime", () => {
    expect(
      extensionForSupplierFile({ type: "video/webm", name: "x.mp4" }, "video")
    ).toBe("webm")
  })

  it("picks mp4 for video without webm mime", () => {
    expect(
      extensionForSupplierFile({ type: "video/mp4", name: "clip.mp4" }, "video")
    ).toBe("mp4")
  })
})
