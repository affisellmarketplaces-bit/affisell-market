import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getGenerativeModel, generateContent } = vi.hoisted(() => ({
  getGenerativeModel: vi.fn(),
  generateContent: vi.fn(),
}))

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getGenerativeModel
  },
}))

import { geminiChatText, geminiTimeoutMs } from "@/lib/ai/gemini-client"

describe("Gemini request timeout", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key")
    generateContent.mockReset().mockResolvedValue({ response: { text: () => " ok " } })
    getGenerativeModel.mockReset().mockReturnValue({ generateContent })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("bounds the call to 5 s by default so the Groq fallback can run inside Vercel's 10 s cap", () => {
    expect(geminiTimeoutMs()).toBe(5_000)
  })

  it("honours GEMINI_TIMEOUT_MS, ignoring junk and values under 1 s", () => {
    vi.stubEnv("GEMINI_TIMEOUT_MS", "8000")
    expect(geminiTimeoutMs()).toBe(8_000)
    vi.stubEnv("GEMINI_TIMEOUT_MS", "abc")
    expect(geminiTimeoutMs()).toBe(5_000)
    vi.stubEnv("GEMINI_TIMEOUT_MS", "50")
    expect(geminiTimeoutMs()).toBe(5_000)
  })

  it("passes the timeout to the SDK as request options", async () => {
    await expect(geminiChatText("prompt", "system")).resolves.toBe("ok")
    const [params, requestOptions] = getGenerativeModel.mock.calls[0]!
    expect(params).toMatchObject({ systemInstruction: "system" })
    expect(requestOptions).toEqual({ timeout: 5_000 })
  })
})
