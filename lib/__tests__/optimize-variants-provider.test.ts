import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { groqChatText } = vi.hoisted(() => ({
  groqChatText: vi.fn(async () => '{"simpleColors":[{"index":0,"name":"Noir"}]}'),
}))
vi.mock("@/lib/ai/groq-client", () => ({ groqChatText }))

import { optimizeSupplierVariants } from "@/lib/supplier-optimize-variants"

const input = {
  mode: "simple" as const,
  title: "T-shirt",
  description: "",
  categoryPath: "Vêtements",
  bullets: [],
  simpleColors: [{ index: 0, name: "noir" }],
}

const okBody = { content: [{ type: "text", text: '{"simpleColors":[{"index":0,"name":"Noir (Claude)"}]}' }] }
const fetchMock = vi.fn()

describe("optimizeSupplierVariants provider order", () => {
  beforeEach(() => {
    groqChatText.mockClear()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.ANTHROPIC_API_KEY
  })

  it("uses Groq only when no Anthropic key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const r = await optimizeSupplierVariants(input)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(groqChatText).toHaveBeenCalledTimes(1)
    expect(r.simpleColors?.[0]?.name).toBe("Noir")
  })

  it("uses Claude first when configured and skips Groq", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test"
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => okBody })
    const r = await optimizeSupplierVariants(input)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(groqChatText).not.toHaveBeenCalled()
    expect(r.simpleColors?.[0]?.name).toBe("Noir (Claude)")
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(sent.model).toMatch(/^claude-/)
    expect(fetchMock.mock.calls[0]![1].headers["x-api-key"]).toBe("sk-ant-test")
  })

  it("falls back to Groq when Claude errors (billing, rate limit, outage)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test"
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: { type: "invalid_request_error", message: "credit balance is too low" } }),
    })
    const r = await optimizeSupplierVariants(input)
    expect(groqChatText).toHaveBeenCalledTimes(1)
    expect(r.simpleColors?.[0]?.name).toBe("Noir")
  })

  it("falls back to Groq when Claude returns an empty answer or the network fails", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test"
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: [] }) })
    await optimizeSupplierVariants(input)
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"))
    await optimizeSupplierVariants(input)
    expect(groqChatText).toHaveBeenCalledTimes(2)
  })
})
