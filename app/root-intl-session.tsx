"use client"

import { Analytics } from "@vercel/analytics/react"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"

import { NavigationShell } from "@/components/navigation/navigation-shell"
import { ThemeProvider } from "@/components/providers/theme-provider"

export function RootSessionShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <NavigationShell />
        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </SessionProvider>
    </ThemeProvider>
  )
}
