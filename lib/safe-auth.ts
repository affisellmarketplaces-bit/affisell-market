import { auth } from "@/auth"

/**
 * Server `auth()` must never take down public pages (missing secret, DB blip, etc.).
 */
export async function safeAuth() {
  try {
    return await auth()
  } catch (error) {
    console.error("[safeAuth]", error)
    return null
  }
}
