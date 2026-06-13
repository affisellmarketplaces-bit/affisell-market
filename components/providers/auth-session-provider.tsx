"use client"

import type { Session } from "next-auth"
import { SessionProvider } from "next-auth/react"

type Props = {
  session: Session | null
  children: React.ReactNode
}

/**
 * Hydrates next-auth from the server session so the client does not race `/api/auth/session`
 * on mount (avoids dev ClientFetchError when the first fetch is aborted by HMR / Strict Mode).
 */
export function AuthSessionProvider({ session, children }: Props) {
  return (
    <SessionProvider
      session={session}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
      refetchInterval={0}
    >
      {children}
    </SessionProvider>
  )
}
