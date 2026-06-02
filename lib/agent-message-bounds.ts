import type { UIMessage } from "ai"

export type AgentMessageBounds = {
  maxMessages: number
  maxTotalUserChars: number
  maxSingleUserChars: number
}

export const DEFAULT_AGENT_MESSAGE_BOUNDS: AgentMessageBounds = {
  maxMessages: 40,
  maxTotalUserChars: 12_000,
  maxSingleUserChars: 2_000,
}

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
}

/** Reject oversized agent payloads (cost / prompt-injection surface). */
export function validateAgentMessages(
  messages: UIMessage[],
  bounds: AgentMessageBounds = DEFAULT_AGENT_MESSAGE_BOUNDS
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "messages_required" }
  }
  if (messages.length > bounds.maxMessages) {
    return { ok: false, error: "too_many_messages" }
  }

  let totalUser = 0
  for (const m of messages) {
    if (m.role !== "user") continue
    const len = messageText(m).length
    if (len > bounds.maxSingleUserChars) {
      return { ok: false, error: "message_too_long" }
    }
    totalUser += len
  }

  if (totalUser > bounds.maxTotalUserChars) {
    return { ok: false, error: "conversation_too_long" }
  }

  return { ok: true }
}
