import type { ReactNode } from "react"
import Link from "next/link"

export default function AffiliateInviteSubLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-white/90 transition hover:text-white"
        >
          Affisell
        </Link>
        <Link
          href="/login/affiliate"
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          Connexion affilié
        </Link>
      </header>
      {children}
    </>
  )
}
