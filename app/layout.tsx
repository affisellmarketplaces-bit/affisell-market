import { Suspense } from "react"

import { SiteNav } from "@/components/site-nav"
import { Providers } from "@/app/providers"
import { STOREFRONT_HTML_LANG } from "@/lib/market-config"

import "./globals.css"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

function HeaderFallback() {
  return <div className="mx-auto flex h-12 max-w-7xl items-center px-1" aria-hidden />
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={STOREFRONT_HTML_LANG}>
      <body className="min-h-screen text-gray-900 [font-family:Inter,system-ui] dark:text-zinc-50">
        <Providers>
          <header className="border-b border-gray-100/90 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
            <Suspense fallback={<HeaderFallback />}>
              <SiteNav />
            </Suspense>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  )
}
