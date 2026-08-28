import { HumanoidShield } from "@/lib/security/humanoid-shield"
import { HONEYPOT_FIELD } from "@/lib/security/honeypot-constants"

export { HONEYPOT_FIELD }

/** Honeypot form field — bots often auto-fill hidden inputs. */
export function isHoneypotFilled(formData: FormData): boolean {
  const value = formData.get(HONEYPOT_FIELD)
  if (value == null) return false
  return String(value).trim().length > 0
}

/** Decoy routes probed by scanners — mirrored from Humanoid Shield. */
export const TRAP_ROUTES = HumanoidShield.SUSPICIOUS_PATHS
