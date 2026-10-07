import { afterEach, describe, expect, it, vi } from "vitest"

import { dataUrlToBlob, imageUrlToBlob } from "@/lib/data-url-to-blob"

afterEach(() => vi.unstubAllGlobals())

describe("dataUrlToBlob", () => {
  it("decodes a base64 image exactly (bytes and type)", async () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1])
    const b64 = Buffer.from(bytes).toString("base64")
    const blob = dataUrlToBlob(`data:image/jpeg;base64,${b64}`)!
    expect(blob.type).toBe("image/jpeg")
    expect(blob.size).toBe(bytes.length)
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes)
  })

  it("tolerates whitespace inside the payload and a charset parameter", async () => {
    const blob = dataUrlToBlob("data:image/png;charset=utf-8;base64,aGVs\nbG8=")!
    expect(blob.type).toBe("image/png")
    expect(await blob.text()).toBe("hello")
  })

  it("decodes a percent-encoded (non-base64) payload", async () => {
    const blob = dataUrlToBlob("data:text/plain,Hello%20World")!
    expect(blob.type).toBe("text/plain")
    expect(await blob.text()).toBe("Hello World")
  })

  it("returns null for anything that is not a well-formed data URL (never throws)", () => {
    for (const bad of ["", "https://cdn/x.jpg", "blob:http://x/abc", "data:image/png;base64", "data:image/png;base64,@@@not-base64@@@"]) {
      expect(dataUrlToBlob(bad), bad).toBeNull()
    }
  })

  it("imageUrlToBlob never calls fetch for a data URL, and falls back to fetch for other URLs", async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(["x"], { type: "image/png" })))
    vi.stubGlobal("fetch", fetchMock)
    await imageUrlToBlob("data:image/png;base64,aGVsbG8=")
    expect(fetchMock).not.toHaveBeenCalled()
    const b = await imageUrlToBlob("blob:http://localhost/abc")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(b.type).toBe("image/png")
  })
})
