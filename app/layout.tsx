import type { Metadata } from "next"
import { headers } from "next/headers"

import { Footer } from "@/components/Footer"
import { AppHeader } from "@/components/nav/app-header"
import { SiteHeaderChrome } from "@/components/nav/site-header-chrome"
import { CookieConsentScriptActivator } from "@/components/cookie-consent/cookie-consent-script-activator"
import { CookieBannerDeferred } from "@/components/CookieBanner-deferred"
import { RootSessionShell } from "@/app/root-intl-session"
import { AuthSessionProvider } from "@/components/providers/auth-session-provider"
import { IntlAppProvider } from "@/components/providers/intl-app-provider"
import { getCachedSession } from "@/lib/get-cached-session"
import { PWA_SPLASH_IMAGES } from "@/lib/pwa-splash-images"
import { bootstrapRootShell } from "@/lib/safe-root-bootstrap"
import { slimClientMessagesForDedicatedStorefront } from "@/lib/i18n-slim-client-messages"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import { isLegionStorefrontPathname } from "@/lib/legion/username"
import ClientGuardInit from "@/components/security/client-guard-init"
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
  const pathname = hdrs.get("x-affisell-pathname") ?? ""
  const isCustomDomain = isCustomDomainHeaders(hdrs)
  const isLegionStorefront = isLegionStorefrontPathname(pathname)
  /** Admin ops + custom domains: lean shell without marketplace header/footer noise. */
  const isAdminOpsSurface =
    pathname.startsWith("/dashboard/admin") || pathname.startsWith("/admin")
  const isDedicatedStorefront = isCustomDomain || isLegionStorefront
  const leanPlatformChrome = isDedicatedStorefront || isAdminOpsSurface
  /**
   * Slim i18n only on custom-domain shops (payload). Légion keeps full messages —
   * otherwise residual client UI (gallery, cookies, etc.) throws MISSING_MESSAGE.
   */
  const clientMessages = isCustomDomain
    ? slimClientMessagesForDedicatedStorefront(messages, pathname)
    : messages

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn(
          "affisell-mobile-shell affisell-epoxy-atmosphere flex min-h-screen min-h-dvh flex-col text-gray-900 [font-family:Inter,system-ui] dark:text-zinc-50",
          isDedicatedStorefront && "affisell-dedicated-storefront affisell-mobile-dock-off",
          isAdminOpsSurface && "affisell-admin-ops-shell"
        )}
      >
        <CookieConsentScriptActivator />
        <AuthSessionProvider session={session}>
          <IntlAppProvider locale={locale} messages={clientMessages} now={now}>
            <RootSessionShell leanShell={leanPlatformChrome}>
              {!leanPlatformChrome ? (
                <SiteHeaderChrome>
                  <AppHeader />
                </SiteHeaderChrome>
              ) : null}
              {children}
              {!leanPlatformChrome ? <Footer /> : null}
            </RootSessionShell>
            <CookieBannerDeferred />
          </IntlAppProvider>
        </AuthSessionProvider>
        <ClientGuardInit />
      </body>
    </html>
  )
}
