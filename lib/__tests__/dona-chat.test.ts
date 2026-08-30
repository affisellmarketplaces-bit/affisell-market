import { describe, expect, it, beforeEach, afterEach } from "vitest"

import { formatDonaStreamError, resolveDonaChatError } from "@/lib/dona/dona-errors"
import { isDonaProviderError, resolveDonaModels } from "@/lib/dona/dona-model"
import { donaAssistantHasContent, donaMessageText } from "@/lib/dona/message-utils"
import type { UIMessage } from "ai"

describe("dona model resolution", () => {
  const envBackup = { ...process.env }

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it("prefers Groq when GROQ_API_KEY is set", () => {
    process.env.GROQ_API_KEY = "test-groq"
    process.env.OPENAI_API_KEY = "test-openai"
    const bundle = resolveDonaModels()
    expect(bundle?.primaryProvider).toBe("groq")
    expect(bundle?.fallbackProvider).toBe("openai")
  })

  it("falls back to OpenAI only when Groq missing", () => {
    delete process.env.GROQ_API_KEY
    process.env.OPENAI_API_KEY = "test-openai"
    const bundle = resolveDonaModels()
    expect(bundle?.primaryProvider).toBe("openai")
    expect(bundle?.fallback).toBeNull()
  })

  it("returns null when no keys configured", () => {
    delete process.env.GROQ_API_KEY
    delete process.env.OPENAI_API_KEY
    expect(resolveDonaModels()).toBeNull()
  })

  it("detects provider billing errors", () => {
    expect(isDonaProviderError(new Error("You have no credits remaining"))).toBe(true)
    expect(isDonaProviderError(new Error("rate limit exceeded"))).toBe(true)
    expect(isDonaProviderError(new Error("hello"))).toBe(false)
  })
})

describe("dona errors", () => {
  it("maps OpenAI billing to Dona voice FR", () => {
    const msg = formatDonaStreamError(new Error("You have no credits remaining"), "fr")
    expect(msg).toContain("Groq")
    expect(msg).toContain("💜")
  })

  it("surfaces stream error message in widget resolver", () => {
    const resolved = resolveDonaChatError(
      new Error("Capitaine, le réacteur OpenAI est à sec."),
      "fr",
      "fallback"
    )
    expect(resolved).toContain("réacteur OpenAI")
  })
})

describe("dona message utils", () => {
  it("extracts text parts", () => {
    const m: UIMessage = {
      id: "1",
      role: "assistant",
      parts: [{ type: "text", text: "Salut Capitaine" }],
    }
    expect(donaMessageText(m)).toBe("Salut Capitaine")
    expect(donaAssistantHasContent(m)).toBe(true)
  })

  it("hides empty assistant bubbles", () => {
    const m: UIMessage = {
      id: "2",
      role: "assistant",
      parts: [{ type: "text", text: "   " }],
    }
    expect(donaAssistantHasContent(m)).toBe(false)
  })
})
