/** Cross-browser id — Safari &lt; 15.4 has no crypto.randomUUID. */
export function safeRandomId(prefix = ""): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}${crypto.randomUUID()}`
  }
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 11)}`
}
