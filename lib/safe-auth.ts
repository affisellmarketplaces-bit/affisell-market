import { auth } from "@/auth"
import { isDynamicServerUsageError } from "@/lib/dynamic-server-error"

/**
 * Server `auth()` must never take down public pages (missing secret, DB blip, etc.).
 */
export async function safeAuth() {
  try {
    return await auth()
  } catch (error) {
    if (!isDynamicServerUsageError(error)) {
      console.error("[safeAuth]", error)
    }
    return null
  }
}
