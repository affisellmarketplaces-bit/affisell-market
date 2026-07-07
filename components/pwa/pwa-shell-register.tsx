"use client"

import { useEffect } from "react"

import { PWA_SW_PATH } from "@/lib/pwa-shell-shared"

function scheduleIdleTask(run: () => void, idleTimeoutMs = 2500, fallbackDelayMs = 600): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: idleTimeoutMs })
    return () => window.cancelIdleCallback(id)
  }
  const t = window.setTimeout(run, fallbackDelayMs)
  return () => window.clearTimeout(t)
}

/** Registers buyer PWA shell SW after hydration — push + offline catalog cache. */
export function PwaShellRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    return scheduleIdleTask(() => {
      void navigator.serviceWorker.register(PWA_SW_PATH, { scope: "/" }).catch((error) => {
        console.error("[pwa-shell-register]", { error })
      })
    })
  }, [])

  return null
}
