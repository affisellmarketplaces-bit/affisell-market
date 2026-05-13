import { Suspense } from "react"

import { LoginRedirectClient } from "./login-redirect-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">
          Chargement…
        </div>
      }
    >
      <LoginRedirectClient />
    </Suspense>
  )
}
