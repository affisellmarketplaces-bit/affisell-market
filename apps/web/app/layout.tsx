import "./globals.css"

import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Affisell Market Intelli",
  description: "Multi-marketplace market intelligence for ecommerce sellers.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-dvh bg-zinc-950 text-zinc-50">
          <header className="border-b border-zinc-800">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/dashboard" className="font-semibold tracking-tight">
                Affisell Market Intelli V2
              </Link>
              <nav className="flex gap-4 text-sm text-zinc-300">
                <Link className="hover:text-white" href="/dashboard">
                  Dashboard
                </Link>
                <Link className="hover:text-white" href="/arbitrage">
                  Arbitrage
                </Link>
                <Link className="hover:text-white" href="/creators">
                  Creators
                </Link>
                <Link className="hover:text-white" href="/connect">
                  Connect TikTok
                </Link>
                <Link className="hover:text-white" href="/settings/billing">
                  Billing
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  )
}

