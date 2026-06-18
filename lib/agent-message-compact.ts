import type { UIMessage } from "ai"

/** Max turns sent to Groq (user+assistant pairs); keeps TPD under control. */
const MAX_MODEL_MESSAGES = 10

function compactToolOutput(output: unknown): unknown {
  if (!Array.isArray(output)) return output
  if (output.length === 0) return output
  return [JSON.stringify({ compact: true, count: output.length })]
}

/**
 * Strip heavy tool JSON from history before `convertToModelMessages`.
 * Full tool payloads stay in client `messages` for cards / checkout intent.
 */
export function compactAgentMessagesForModel(messages: UIMessage[]): UIMessage[] {
  const slice =
    messages.length > MAX_MODEL_MESSAGES ? messages.slice(-MAX_MODEL_MESSAGES) : messages

  return slice.map((m) => {
    if (m.role !== "assistant") return m

    const parts = m.parts.map((part) => {
      if (part.type === "tool-searchProducts") {
        const p = part as { output?: unknown }
        if (p.output != null) {
          return { ...part, output: compactToolOutput(p.output) }
        }
      }
      if (part.type === "text" && "text" in part && typeof part.text === "string" && part.text.length > 240) {
        return { ...part, text: `${part.text.slice(0, 220)}…` }
      }
      return part
    })

    return { ...m, parts }
  })
}
