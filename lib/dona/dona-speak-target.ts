import type { UIMessage } from "ai"

import { donaMessageText } from "@/lib/dona/message-utils"

/** Latest assistant message with speakable text (for TTS after stream settles). */
export function resolveDonaSpeakTarget(
  messages: UIMessage[]
): { id: string; text: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m || m.role !== "assistant") continue
    const text = donaMessageText(m).trim()
    if (!text) continue
    return { id: m.id, text }
  }
  return null
}
