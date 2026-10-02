import { beforeEach, describe, expect, it, vi } from "vitest"

const { groqChatText } = vi.hoisted(() => ({ groqChatText: vi.fn() }))
vi.mock("@/lib/ai/groq-client", () => ({
  groqChatText,
  GROQ_VISION_MODEL: "vision-model",
  GROQ_TEXT_MODEL: "text-model",
  isGroqRateLimitError: (e: unknown) => /429|rate.?limit/i.test(e instanceof Error ? e.message : String(e)),
}))

import { groqTaxonomyCall, splitTaxonomyContent } from "@/lib/ai/groq-taxonomy-model"

const system = [
  { type: "text" as const, text: "SYSTEM A" },
  { type: "text" as const, text: "SYSTEM B", cache_control: { type: "ephemeral" as const } },
]
const photo = { type: "image" as const, source: { type: "url" as const, url: "https://cdn.example.com/p.jpg" } }
const text = { type: "text" as const, text: "Supplier title: Action Figure" }

describe("splitTaxonomyContent", () => {
  it("flattens system blocks, joins text blocks and keeps only http(s) image urls", () => {
    const out = splitTaxonomyContent({
      system,
      content: [photo, text, { type: "image", source: { type: "url", url: "blob:local" } }],
    })
    expect(out.system).toBe("SYSTEM A\n\nSYSTEM B")
    expect(out.text).toBe("Supplier title: Action Figure")
    expect(out.imageUrls).toEqual(["https://cdn.example.com/p.jpg"])
  })
})

describe("groqTaxonomyCall", () => {
  beforeEach(() => {
    groqChatText.mockReset()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  it("makes a single direct attempt (no router / SDK backoff / OpenAI fallback) with JSON mode and low reasoning effort", async () => {
    groqChatText.mockResolvedValue('{"ok":true}')
    await expect(groqTaxonomyCall({ system, content: [text] })).resolves.toBe('{"ok":true}')
    const opts = groqChatText.mock.calls[0]![0]
    expect(opts).toMatchObject({
      vision: false,
      direct: true,
      model: "openai/gpt-oss-120b",
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    })
    expect(opts.messages[0]).toEqual({ role: "system", content: "SYSTEM A\n\nSYSTEM B" })
    expect(opts.messages[1]).toEqual({ role: "user", content: "Supplier title: Action Figure" })
  })

  it("sends the photo to the vision model when there is one", async () => {
    groqChatText.mockResolvedValue("{}")
    await groqTaxonomyCall({ system, content: [photo, text] })
    const opts = groqChatText.mock.calls[0]![0]
    expect(opts.vision).toBe(true)
    expect(opts.model).toBe("vision-model")
    expect(opts.messages[1].content).toEqual([
      { type: "text", text: "Supplier title: Action Figure" },
      { type: "image_url", image_url: { url: "https://cdn.example.com/p.jpg" } },
    ])
  })

  it("retries text-only when the photo cannot be used, so the title still classifies", async () => {
    groqChatText.mockRejectedValueOnce(new Error("could not fetch image")).mockResolvedValueOnce('{"ok":1}')
    await expect(groqTaxonomyCall({ system, content: [photo, text] })).resolves.toBe('{"ok":1}')
    expect(groqChatText).toHaveBeenCalledTimes(2)
    expect(groqChatText.mock.calls[1]![0].vision).toBe(false)
  })

  it("switches to the sibling model when the primary is rate limited (each model has its own token budget)", async () => {
    groqChatText.mockRejectedValueOnce(new Error("429 rate limit reached")).mockResolvedValueOnce('{"ok":2}')
    await expect(groqTaxonomyCall({ system, content: [text] })).resolves.toBe('{"ok":2}')
    expect(groqChatText.mock.calls.map((c) => c[0].model)).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"])
  })

  it("does not retry on a non rate-limit failure", async () => {
    groqChatText.mockRejectedValue(new Error("invalid_request_error"))
    await expect(groqTaxonomyCall({ system, content: [text] })).rejects.toThrow("invalid_request_error")
    expect(groqChatText).toHaveBeenCalledTimes(1)
  })

  it("falls back to a text model when the vision model is rate limited", async () => {
    groqChatText.mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce('{"ok":3}')
    await expect(groqTaxonomyCall({ system, content: [photo, text] })).resolves.toBe('{"ok":3}')
    expect(groqChatText.mock.calls[1]![0].vision).toBe(false)
  })

  it("throws on an empty answer instead of returning garbage", async () => {
    groqChatText.mockResolvedValue("   ")
    await expect(groqTaxonomyCall({ system, content: [text] })).rejects.toThrow("groq_taxonomy_empty_response")
  })

  it("times out instead of hanging the request", async () => {
    groqChatText.mockReturnValue(new Promise(() => undefined))
    await expect(groqTaxonomyCall({ system, content: [text], timeoutMs: 20 })).rejects.toThrow("groq_taxonomy_timeout_20ms")
  })
})
