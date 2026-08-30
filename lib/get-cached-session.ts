import { cache } from "react"

import { auth } from "@/auth"

/** One `auth()` per RSC request — feeds SessionProvider to skip client bootstrap fetch. */
export const getCachedSession = cache(async () => {
  try {
    return await auth()
  } catch (err) {
    console.error("[auth session]", {
      result: "layout_session_failed",
      message: err instanceof Error ? err.message : String(err),
    })
    return null
  }
})
