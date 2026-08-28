import { HONEYPOT_FIELD } from "@/lib/security/honeypot-constants"
import { isHoneypotFilled } from "@/lib/security/honeypot"

export function logHoneypotFormBlocked(context: string): void {
  console.log("[shield]", JSON.stringify({ event: "HONEYPOT_FORM", context }))
}

export function checkHoneypot(formData: FormData): { isBot: boolean } {
  const isBot = isHoneypotFilled(formData)
  if (isBot) logHoneypotFormBlocked("server_action")
  return { isBot }
}

export function checkHoneypotBody(body: unknown): { isBot: boolean } {
  if (!body || typeof body !== "object") return { isBot: false }
  const raw = (body as Record<string, unknown>)[HONEYPOT_FIELD]
  if (raw == null) return { isBot: false }
  return { isBot: String(raw).trim().length > 0 }
}

export function assertHoneypotForm(formData: FormData): void {
  if (checkHoneypot(formData).isBot) {
    throw new Error("Bot detected")
  }
}
