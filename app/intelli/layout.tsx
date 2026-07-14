"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect } from "react"

function hasMarketIntelliFeature(features: string[] | undefined): boolean {
  return Array.isArray(features) && features.includes("market_intelli")
}

export default function IntelliLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === "loading") return
    if (!session?.user) {
      router.replace("/login")
      return
    }
    if (!hasMarketIntelliFeature(session.user.features)) {
      router.replace("/pricing")
    }
  }, [session, status, router])

  if (status === "loading" || !session?.user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-zinc-500">Chargement…</div>
    )
  }

  if (!hasMarketIntelliFeature(session.user.features)) {
    return null
  }

  const nav = [
    { href: "/intelli", label: "Dashboard" },
    { href: "/intelli/connect", label: "Connecter TikTok" },
  ]

  return (
    <div className="min-h-[60vh] bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-600">Market Intelli</p>
            <h1 className="text-lg font-semibold text-zinc-900">TikTok Shop insights</h1>
          </div>
          <nav className="flex gap-2 text-sm">
            {nav.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "rounded-md bg-violet-600 px-3 py-1.5 font-medium text-white"
                      : "rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
