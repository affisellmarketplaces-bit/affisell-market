"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * `/login` exists for bookmarks and old links. Canonical sign-in is `/auth/signin`.
 * Client redirect avoids a blank shell when the server `redirect()` does not update the URL as expected.
 */
export function LoginRedirectClient() {
  const router = useRouter()
  const search = useSearchParams()

  useEffect(() => {
    const q = search.toString()
    router.replace(q ? `/auth/signin?${q}` : "/auth/signin")
  }, [router, search])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
      <p>Redirection vers la connexion…</p>
    </div>
  )
}
