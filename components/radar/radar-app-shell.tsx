"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect } from "react"

function hasRadarFeature(features: string[] | undefined): boolean {
  return (
    Array.isArray(features) &&
    (features.includes("radar") || features.includes("market_intelli"))
  )
}

export default function RadarAppShell({
  children,
  unreadCount = 0,
}: {
  children: React.ReactNode
  unreadCount?: number
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const nav = [
    { href: "/radar", label: "Dashboard" },
    { href: "/radar/connect", label: "Connect" },
    { href: "/radar/winners", label: "Winners" },
    {
      href: "/radar/alerts",
      label: unreadCount > 0 ? `🚨 Alertes ${unreadCount}` : "🚨 Alertes",
    },
    { href: "/radar/map", label: "🗺️ Map" },
  ]

  useEffect(() => {
    if (status === "loading") return
    if (!session?.user) {
      router.replace("/login")
      return
    }
    if (!hasRadarFeature(session.user.features)) {
      router.replace("/pricing")
    }
  }, [session, status, router])

  if (status === "loading" || !session?.user) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-zinc-500">Chargement…</div>
  }

  if (!hasRadarFeature(session.user.features)) {
    return null
  }

  return (
    <div className="min-h-[60vh] bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
              Affisell Radar
            </p>
            <h1 className="text-lg font-semibold text-zinc-900">
              📡 Affisell Radar — Vois les winners avant tout le monde
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/radar" && pathname.startsWith(item.href))
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
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
