"use client"

import { usePathname } from "next/navigation"
import { Toaster } from "sonner"

import { isImmersiveBuyerRoute } from "@/lib/mobile-chrome"

/** Global toasts — hidden on immersive routes (Pulse, Luxe, etc.) to avoid stacking with in-app feedback. */
export function MobileAwareToaster() {
  const pathname = usePathname() ?? ""
  if (isImmersiveBuyerRoute(pathname)) return null

  return (
    <Toaster
      richColors
      closeButton
      position="top-center"
      visibleToasts={1}
      duration={3200}
      toastOptions={{
        className: "affisell-sonner-toast",
      }}
    />
  )
}
