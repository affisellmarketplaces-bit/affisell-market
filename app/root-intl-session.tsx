"use client"

import { AnalyticsGated } from "@/components/legal/analytics-gated"
import { ImmersiveChromeSync } from "@/components/layout/immersive-chrome-sync"
import { NavigationShell } from "@/components/navigation/navigation-shell"
import { MobileAwareToaster } from "@/components/providers/mobile-aware-toaster"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { PwaInstallBanner } from "@/components/pwa/pwa-install-banner"
import { PwaShellRegister } from "@/components/pwa/pwa-shell-register"

export function RootSessionShell({
  children,
  leanShell = false,
}: {
  children: React.ReactNode
  leanShell?: boolean
}) {
  return (
    <ThemeProvider>
      <ImmersiveChromeSync />
      <MobileAwareToaster />
      {!leanShell ? (
        <>
          <PwaShellRegister />
          <NavigationShell />
          <PwaInstallBanner />
          <AnalyticsGated />
        </>
      ) : null}
      {children}
    </ThemeProvider>
  )
}
