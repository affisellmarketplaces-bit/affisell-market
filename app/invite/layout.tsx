import type { ReactNode } from "react"
import Link from "next/link"

/**
 * Public supplier invite — minimal chrome (root layout header hidden via CSS).
 */
export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <div data-invite-shell className="relative min-h-[100dvh]">
      <style>{`
        body:has([data-invite-shell]) header[class*="border-b"] {
          display: none !important;
        }
        body:has([data-invite-shell]) footer {
          display: none !important;
        }
      `}</style>
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-white/90 transition hover:text-white"
        >
          Affisell
        </Link>
        <Link
          href="/login/supplier"
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          Connexion fournisseur
        </Link>
      </header>
      {children}
    </div>
  )
}
