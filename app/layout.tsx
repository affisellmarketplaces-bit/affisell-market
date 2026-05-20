import { Suspense } from "react"
import { getLocale, getMessages, setRequestLocale } from "next-intl/server"

import { AppHeader } from "@/components/nav/app-header"
import { RootSessionShell } from "@/app/root-intl-session"
import { IntlAppProvider } from "@/components/providers/intl-app-provider"
import { resolveAppLocale } from "@/lib/i18n-locale"

import "./globals.css"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

function HeaderFallback() {
  return <div className="mx-auto flex h-12 max-w-7xl items-center px-1" aria-hidden />
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = resolveAppLocale(await getLocale())
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen pb-[calc(4.25rem+env(safe-area-inset-bottom))] text-gray-900 [font-family:Inter,system-ui] md:pb-0 dark:text-zinc-50">
        <IntlAppProvider locale={locale} messages={messages}>
          <RootSessionShell>
            <header className="relative z-[100] border-b border-gray-100/90 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
              <Suspense fallback={<HeaderFallback />}>
                <AppHeader />
              </Suspense>
            </header>
            {children}
          </RootSessionShell>
        </IntlAppProvider>
      </body>
    </html>
  )
}
