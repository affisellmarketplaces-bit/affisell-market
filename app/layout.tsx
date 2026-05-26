import { Footer } from "@/components/layout/Footer"
import { AppHeader } from "@/components/nav/app-header"
import { RootSessionShell } from "@/app/root-intl-session"
import { IntlAppProvider } from "@/components/providers/intl-app-provider"
import { bootstrapRootShell } from "@/lib/safe-root-bootstrap"

import "./globals.css"

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages, now } = await bootstrapRootShell()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="affisell-mobile-shell min-h-screen text-gray-900 [font-family:Inter,system-ui] dark:text-zinc-50">
        <IntlAppProvider locale={locale} messages={messages} now={now}>
          <RootSessionShell>
            <header className="relative z-[100] border-b border-gray-100/90 bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur-md md:py-3 dark:border-zinc-800 dark:bg-zinc-950/90">
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
