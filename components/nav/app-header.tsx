"use client"

import { SiteNav } from "@/components/site-nav"

/** Client session via `useSession` inside SiteNav — avoids server `auth()` on every RSC request. */
export function AppHeader() {
  return <SiteNav />
}
