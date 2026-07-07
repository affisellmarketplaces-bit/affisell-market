import type { Metadata } from "next"
import { headers } from "next/headers"

import { Footer } from "@/components/Footer"
import { AppHeader } from "@/components/nav/app-header"
import { SiteHeaderChrome } from "@/components/nav/site-header-chrome"
import { CookieConsentHeadScripts } from "@/components/cookie-consent/cookie-consent-head"
import { CookieBannerDeferred } from "@/components/CookieBanner-deferred"
import { RootSessionShell } from "@/app/root-intl-session"
import { AuthSessionProvider } from "@/components/providers/auth-session-provider"
import { IntlAppProvider } from "@/components/providers/intl-app-provider"
import { getCachedSession } from "@/lib/get-cached-session"
import { PWA_SPLASH_IMAGES } from "@/lib/pwa-splash-images"
import { bootstrapRootShell } from "@/lib/safe-root-bootstrap"
import { slimClientMessagesForDedicatedStorefront } from "@/lib/i18n-slim-client-messages"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import { cn } from "@/lib/utils"

import "./globals.css"

export const metadata: Metadata = {
  applicationName: "Affisell",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Affisell",
    startupImage: [...PWA_SPLASH_IMAGES],
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafc" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, messages, now }, session] = await Promise.all([
    bootstrapRootShell(),
    getCachedSession(),
  ])
  const hdrs = await headers()
  const isDedicatedStorefront = isCustomDomainHeaders(hdrs)
  const pathname = hdrs.get("x-affisell-pathname") ?? ""
  const clientMessages = isDedicatedStorefront
    ? slimClientMessagesForDedicatedStorefront(messages, pathname)
    : messages

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn(
          "affisell-mobile-shell affisell-epoxy-atmosphere flex min-h-dvh flex-col text-gray-900 [font-family:Inter,system-ui] dark:text-zinc-50",
          isDedicatedStorefront && "affisell-dedicated-storefront affisell-mobile-dock-off"
        )}
      >
        <CookieConsentHeadScripts />
        <AuthSessionProvider session={session}>
          <IntlAppProvider locale={locale} messages={clientMessages} now={now}>
            <RootSessionShell leanShell={isDedicatedStorefront}>
              {!isDedicatedStorefront ? (
                <SiteHeaderChrome>
                  <AppHeader />
                </SiteHeaderChrome>
              ) : null}
              {children}
              {!isDedicatedStorefront ? <Footer /> : null}
            </RootSessionShell>
            <CookieBannerDeferred />
          </IntlAppProvider>
        </AuthSessionProvider>
      </body>
    </html>
  )
}
