/** localStorage key for guest agent session (sent with chat + history API). */
export const AGENT_SESSION_STORAGE_KEY = "affisell-agent-session-id"

export function getOrCreateAgentSessionId(): string {
  if (typeof window === "undefined") return ""
  try {
    let id = localStorage.getItem(AGENT_SESSION_STORAGE_KEY)?.trim()
    if (!id || id.length < 8) {
      id = crypto.randomUUID()
      localStorage.setItem(AGENT_SESSION_STORAGE_KEY, id)
    }
    return id
  } catch {
    return ""
  }
}
