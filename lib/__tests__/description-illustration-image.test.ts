import { describe, expect, it } from "vitest"

import { imageFilesFromDataTransfer } from "@/lib/description-illustration-image"

describe("imageFilesFromDataTransfer", () => {
  it("returns empty for null", () => {
    expect(imageFilesFromDataTransfer(null)).toEqual([])
  })

  it("collects image files from items", () => {
    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" })
    const dt = {
      files: { length: 0 },
      items: [
        { kind: "file", type: "image/png", getAsFile: () => file },
        { kind: "string", type: "text/plain", getAsFile: () => null },
      ],
    } as unknown as DataTransfer

    expect(imageFilesFromDataTransfer(dt)).toEqual([file])
  })
})
