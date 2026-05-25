import { Footer } from "@/components/layout/Footer"
import { AppHeader } from "@/components/nav/app-header"
import { RootSessionShell } from "@/app/root-intl-session"
import { IntlAppProvider } from "@/components/providers/intl-app-provider"
import { bootstrapRootShell } from "@/lib/safe-root-bootstrap"

import "./globals.css"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages, now } = await bootstrapRootShell()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen pb-[calc(4.25rem+env(safe-area-inset-bottom))] text-gray-900 [font-family:Inter,system-ui] md:pb-0 dark:text-zinc-50">
        <IntlAppProvider locale={locale} messages={messages} now={now}>
          <RootSessionShell>
            <header className="relative z-[100] border-b border-gray-100/90 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
              <AppHeader />
            </header>
            {children}
            <Footer />
          </RootSessionShell>
        </IntlAppProvider>
      </body>
    </html>
  )
}
