"use client"

import { SiteNav } from "@/components/site-nav"

/** Session hydrated from root layout — SiteNav reads it via `useSession` without a client bootstrap fetch. */
export function AppHeader() {
  return <SiteNav />
}
