import { Suspense } from "react"

import { SiteNav } from "@/components/site-nav"

import "./globals.css"

function HeaderFallback() {
  return <div className="mx-auto flex h-12 max-w-7xl items-center px-1" aria-hidden />
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased [font-family:Inter,system-ui] dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <Suspense fallback={<HeaderFallback />}>
            <SiteNav />
          </Suspense>
        </header>
        {children}
      </body>
    </html>
  )
}
