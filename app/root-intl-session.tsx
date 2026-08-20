"use client"

import { AnalyticsGatedDeferred } from "@/components/legal/analytics-gated-deferred"
import { ImmersiveChromeSync } from "@/components/layout/immersive-chrome-sync"
import { NavigationShell } from "@/components/navigation/navigation-shell"
import { MobileAwareToaster } from "@/components/providers/mobile-aware-toaster"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { PwaInstallBannerDeferred } from "@/components/pwa/pwa-install-banner-deferred"
import { PwaShellRegister } from "@/components/pwa/pwa-shell-register"
import { ClientShellErrorBoundary } from "@/components/shell/client-shell-error-boundary"

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
          <ClientShellErrorBoundary label="navigation">
            <NavigationShell />
          </ClientShellErrorBoundary>
          <ClientShellErrorBoundary label="pwa-banner">
            <PwaInstallBannerDeferred />
          </ClientShellErrorBoundary>
          <ClientShellErrorBoundary label="analytics">
            <AnalyticsGatedDeferred />
          </ClientShellErrorBoundary>
        </>
      ) : null}
      {children}
    </ThemeProvider>
  )
}
