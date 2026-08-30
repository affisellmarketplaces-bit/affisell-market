"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

import { useIdleMount } from "@/hooks/use-idle-mount"

const DonaPublicWidget = dynamic(
  () =>
    import("@/components/dona/DonaPublicWidget").then((m) => ({
      default: m.DonaPublicWidget,
    })),
  { ssr: false }
)

const DonaCaptainWidget = dynamic(
  () =>
    import("@/components/dona/DonaCaptainWidget").then((m) => ({
      default: m.DonaCaptainWidget,
    })),
  { ssr: false }
)

function shouldLoadPublicWidget(pathname: string): boolean {
  return !pathname.startsWith("/dashboard") && !pathname.startsWith("/admin")
}

function shouldLoadCaptainWidget(pathname: string): boolean {
  return pathname.startsWith("/dashboard/supplier") || pathname.startsWith("/radar")
}

/** Dona chat — idle + code-split; skips routes where widgets never render. */
export function DonaWidgetsDeferred() {
  const pathname = usePathname() ?? ""
  const ready = useIdleMount({ idleTimeoutMs: 3200, fallbackDelayMs: 900 })

  if (!ready) return null

  const showPublic = shouldLoadPublicWidget(pathname)
  const showCaptain = shouldLoadCaptainWidget(pathname)
  if (!showPublic && !showCaptain) return null

  return (
    <>
      {showPublic ? <DonaPublicWidget /> : null}
      {showCaptain ? <DonaCaptainWidget /> : null}
    </>
  )
}
