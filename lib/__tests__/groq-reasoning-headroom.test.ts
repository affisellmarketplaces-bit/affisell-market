import { beforeEach, describe, expect, it, vi } from "vitest"

const create = vi.fn(async (_args: Record<string, unknown>) => ({
  choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
}))

vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create } }
  },
}))
vi.mock("@/lib/ai/llm-router", () => ({
  routeLlmText: async ({ runGroq }: { runGroq: () => Promise<string | null> }) => ({ text: await runGroq(), provider: "groq" }),
}))

import { GROQ_REASONING_HEADROOM_TOKENS, groqChatText } from "@/lib/ai/groq-client"

const messages = [{ role: "user", content: "hi" }] as never

describe("groq reasoning models", () => {
  beforeEach(() => {
    create.mockClear()
    process.env.GROQ_API_KEY = "test-key"
  })

  it("reserves headroom for hidden reasoning tokens (gpt-oss)", async () => {
    await groqChatText({ model: "openai/gpt-oss-20b", messages, max_tokens: 900 })
    expect(create.mock.calls[0]![0].max_tokens).toBe(900 + GROQ_REASONING_HEADROOM_TOKENS)
  })

  it("passes reasoning_effort only when asked, and only to reasoning models", async () => {
    await groqChatText({ model: "openai/gpt-oss-20b", messages, max_tokens: 900, reasoning_effort: "low" })
    expect(create.mock.calls[0]![0].reasoning_effort).toBe("low")

    create.mockClear()
    await groqChatText({ model: "openai/gpt-oss-20b", messages, max_tokens: 900 })
    expect(create.mock.calls[0]![0]).not.toHaveProperty("reasoning_effort")
  })

  it("leaves non-reasoning models untouched", async () => {
    await groqChatText({ model: "llama-3.3-70b-instruct", messages, max_tokens: 900, reasoning_effort: "low" })
    const args = create.mock.calls[0]![0]
    expect(args.max_tokens).toBe(900)
    expect(args).not.toHaveProperty("reasoning_effort")
  })
})
