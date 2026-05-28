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
      <body className="affisell-mobile-shell affisell-epoxy-atmosphere min-h-screen text-gray-900 [font-family:Inter,system-ui] dark:text-zinc-50">
        <IntlAppProvider locale={locale} messages={messages} now={now}>
          <RootSessionShell>
            <header className="affisell-global-site-header relative z-[100] px-3 pt-2 md:px-4 md:pt-3">
              <div className="affisell-header-shell relative mx-auto max-w-7xl">
                <div className="affisell-header-mesh pointer-events-none absolute inset-0" aria-hidden />
                <div className="relative z-[2]">
                  <AppHeader />
                </div>
              </div>
            </header>
            {children}
            <Footer />
          </RootSessionShell>
        </IntlAppProvider>
      </body>
    </html>
  )
}
