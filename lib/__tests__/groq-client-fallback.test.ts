import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

describe("groqChatText OpenAI fallback", () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...envBackup }
    vi.restoreAllMocks()
  })

  it("falls back to OpenAI when Groq rate-limits", async () => {
    process.env.GROQ_API_KEY = "test-groq"
    process.env.OPENAI_API_KEY = "test-openai"

    vi.doMock("groq-sdk", () => ({
      default: class Groq {
        chat = {
          completions: {
            create: vi.fn().mockRejectedValue({ status: 429, message: "rate limit" }),
          },
        }
      },
    }))

    vi.doMock("openai", () => ({
      default: class OpenAI {
        chat = {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: "fallback ok" } }],
            }),
          },
        }
      },
    }))

    const { groqChatText } = await import("@/lib/ai/groq-client")
    const result = await groqChatText({
      messages: [{ role: "user", content: "hello" }],
    })
    expect(result).toBe("fallback ok")
  })

  it("uses OpenAI when Groq key is missing", async () => {
    delete process.env.GROQ_API_KEY
    process.env.OPENAI_API_KEY = "test-openai"

    vi.doMock("groq-sdk", () => ({ default: class Groq {} }))
    vi.doMock("openai", () => ({
      default: class OpenAI {
        chat = {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: "openai primary" } }],
            }),
          },
        }
      },
    }))

    const { groqChatText } = await import("@/lib/ai/groq-client")
    const result = await groqChatText({
      messages: [{ role: "user", content: "hello" }],
    })
    expect(result).toBe("openai primary")
  })
})
