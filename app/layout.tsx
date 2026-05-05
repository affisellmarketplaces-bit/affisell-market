import { SiteNav } from "@/components/site-nav"

import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased [font-family:Inter,system-ui] dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <SiteNav />
        </header>
        {children}
      </body>
    </html>
  )
}
