"use client"

import { HONEYPOT_FIELD } from "@/lib/security/honeypot-constants"

export { HONEYPOT_FIELD }

export function reportClientBot(reason: string): void {
  void fetch("/api/security/logs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "CLIENT_BOT",
      ua: navigator.userAgent,
      path: location.pathname,
      data: reason,
    }),
  }).catch(() => undefined)
}

export function isHoneypotTripped(formData: FormData): boolean {
  const value = formData.get(HONEYPOT_FIELD)
  if (value == null) return false
  return String(value).trim().length > 0
}

/** Returns true when submit should be blocked. */
export function blockIfHoneypot(formData: FormData): boolean {
  if (!isHoneypotTripped(formData)) return false
  reportClientBot("honeypot_form")
  return true
}

export function blockIfHoneypotValue(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  reportClientBot("honeypot_form")
  return true
}
