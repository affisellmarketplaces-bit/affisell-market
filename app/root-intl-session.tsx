"use client"

import { SessionProvider } from "next-auth/react"
import { AnalyticsGated } from "@/components/legal/analytics-gated"
import { ImmersiveChromeSync } from "@/components/layout/immersive-chrome-sync"
import { NavigationShell } from "@/components/navigation/navigation-shell"
import { MobileAwareToaster } from "@/components/providers/mobile-aware-toaster"
import { ThemeProvider } from "@/components/providers/theme-provider"

export function RootSessionShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <ImmersiveChromeSync />
        <NavigationShell />
        {children}
        <MobileAwareToaster />
        <AnalyticsGated />
      </SessionProvider>
    </ThemeProvider>
  )
}
