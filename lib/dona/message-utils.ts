import type { UIMessage } from "ai"

export function donaMessageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export function donaAssistantHasContent(m: UIMessage): boolean {
  if (m.role !== "assistant") return true
  if (donaMessageText(m).trim().length > 0) return true
  return m.parts.some(
    (p) =>
      p.type === "tool-searchProducts" ||
      p.type === "tool-getBestsellers" ||
      (typeof p.type === "string" && p.type.startsWith("tool-"))
  )
}
