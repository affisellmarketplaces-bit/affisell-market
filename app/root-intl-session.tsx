"use client"

import { AnalyticsGated } from "@/components/legal/analytics-gated"
import { ImmersiveChromeSync } from "@/components/layout/immersive-chrome-sync"
import { NavigationShell } from "@/components/navigation/navigation-shell"
import { MobileAwareToaster } from "@/components/providers/mobile-aware-toaster"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { PwaInstallBanner } from "@/components/pwa/pwa-install-banner"

export function RootSessionShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ImmersiveChromeSync />
      <NavigationShell />
      {children}
      <PwaInstallBanner />
      <MobileAwareToaster />
      <AnalyticsGated />
    </ThemeProvider>
  )
}
