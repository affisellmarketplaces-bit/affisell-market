import { Footer } from "@/components/Footer"
import { AppHeader } from "@/components/nav/app-header"
import { RootSessionShell } from "@/app/root-intl-session"
import { LocaleServerSync } from "@/components/locale-server-sync"
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
      <body className="affisell-mobile-shell affisell-epoxy-atmosphere flex min-h-dvh flex-col text-gray-900 [font-family:Inter,system-ui] dark:text-zinc-50">
        <IntlAppProvider locale={locale} messages={messages} now={now}>
          <LocaleServerSync serverLocale={locale} />
          <RootSessionShell>
            <header className="affisell-global-site-header relative z-[200] w-full max-w-full shrink-0 overflow-x-clip px-3 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-4 md:pt-3">
              <div className="affisell-header-shell relative mx-auto max-w-7xl min-w-0 overflow-hidden md:overflow-visible">
                <div className="affisell-header-mesh pointer-events-none absolute inset-0" aria-hidden />
                <div className="relative z-[2]">
                  <AppHeader />
                </div>
              </div>
            </header>
            <div className="affisell-page-shell">{children}</div>
            <Footer />
          </RootSessionShell>
        </IntlAppProvider>
      </body>
    </html>
  )
}
