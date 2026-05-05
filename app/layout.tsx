import Link from "next/link"

import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased [font-family:Inter,system-ui] dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <nav className="mx-auto flex max-w-6xl items-center justify-end gap-6 text-sm">
            <Link href="/agent" className="text-zinc-700 hover:underline dark:text-zinc-300">
              Agent
            </Link>
            <Link href="/marketplace" className="text-zinc-700 hover:underline dark:text-zinc-300">
              Marketplace
            </Link>
            <a href="/cart" className="text-zinc-700 hover:underline dark:text-zinc-300">
              Cart
            </a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
