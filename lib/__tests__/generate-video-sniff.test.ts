import { describe, expect, it } from "vitest"

import { sniffVideoContainer } from "@/lib/social/video-container-sniff"

describe("sniffVideoContainer", () => {
  it("detects ftyp MP4 magic", () => {
    const bytes = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])
    expect(sniffVideoContainer(bytes)).toBe("mp4")
  })

  it("detects WebM EBML header", () => {
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])
    expect(sniffVideoContainer(bytes)).toBe("webm")
  })

  it("returns unknown for garbage", () => {
    expect(sniffVideoContainer(new Uint8Array([1, 2, 3, 4]))).toBe("unknown")
  })
})
