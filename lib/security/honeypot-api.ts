import { checkHoneypotBody, logHoneypotFormBlocked } from "@/lib/security/secure-action"

export function rejectIfHoneypotBody(body: unknown, context: string): Response | null {
  if (!checkHoneypotBody(body).isBot) return null
  logHoneypotFormBlocked(context)
  return Response.json({ error: "Bot detected" }, { status: 403 })
}
