import { describe, expect, it } from "vitest"
import type { UIMessage } from "ai"

import { validateAgentMessages } from "@/lib/agent-message-bounds"

function userMsg(text: string): UIMessage {
  return {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text }],
  }
}

describe("validateAgentMessages", () => {
  it("accepts normal conversation", () => {
    expect(validateAgentMessages([userMsg("hello")])).toEqual({ ok: true })
  })

  it("rejects empty and oversized payloads", () => {
    expect(validateAgentMessages([])).toEqual({ ok: false, error: "messages_required" })
    expect(validateAgentMessages([userMsg("x".repeat(3000))])).toEqual({
      ok: false,
      error: "message_too_long",
    })
  })
})
