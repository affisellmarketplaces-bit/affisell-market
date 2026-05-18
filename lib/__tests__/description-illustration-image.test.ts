import { describe, expect, it } from "vitest"

import { imageFilesFromDataTransfer } from "@/lib/description-illustration-image"

describe("imageFilesFromDataTransfer", () => {
  it("accepts clipboard files with empty MIME type", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "screenshot.png", { type: "" })
    const dt = {
      files: [file],
      items: [
        {
          kind: "file",
          type: "",
          getAsFile: () => file,
        },
      ],
    } as unknown as DataTransfer

    expect(imageFilesFromDataTransfer(dt)).toHaveLength(1)
  })
})
