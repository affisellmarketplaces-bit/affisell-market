import { Suspense } from "react"

import { SiteNav } from "@/components/site-nav"
import { auth } from "@/auth"

function HeaderFallback() {
  return <div className="mx-auto flex h-12 max-w-7xl items-center px-1" aria-hidden />
}

export async function AppHeader() {
  const session = await auth()
  const role = session?.user?.role ?? null

  return (
    <Suspense fallback={<HeaderFallback />}>
      <SiteNav initialRole={role} />
    </Suspense>
  )
}
