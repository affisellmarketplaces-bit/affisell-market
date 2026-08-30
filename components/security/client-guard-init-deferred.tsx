"use client"

import dynamic from "next/dynamic"

import { useIdleMount } from "@/hooks/use-idle-mount"

const ClientGuardInit = dynamic(() => import("@/components/security/client-guard-init"), {
  ssr: false,
})

/** Anti-bot guard after idle — keeps fetch patch off LCP/TBT critical path. */
export default function ClientGuardInitDeferred() {
  const ready = useIdleMount({ idleTimeoutMs: 2800, fallbackDelayMs: 800 })
  if (!ready) return null
  return <ClientGuardInit />
}
