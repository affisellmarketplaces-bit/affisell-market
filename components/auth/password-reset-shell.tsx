"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { KeyRound, Shield } from "lucide-react"

import type { LoginPortal } from "@/lib/auth-login-portal"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  portal?: LoginPortal | null
  badge: string
  title: string
  subtitle: string
  backHref: string
  backLabel: string
}

const portalAccent: Record<string, string> = {
  AFFILIATE: "from-violet-500/30 via-fuchsia-500/20 to-transparent",
  SUPPLIER: "from-blue-500/30 via-indigo-500/20 to-transparent",
  default: "from-violet-500/25 via-cyan-500/15 to-transparent",
}

export function PasswordResetShell({
  children,
  portal = null,
  badge,
  title,
  subtitle,
  backHref,
  backLabel,
}: Props) {
  const accent = portal ? portalAccent[portal] ?? portalAccent.default : portalAccent.default

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4 py-14">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.35),transparent)]"
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-gradient-to-br blur-3xl animate-pulse",
          accent
        )}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-1/4 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-500/20 via-transparent to-transparent blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_40px_-10px_rgba(168,85,247,0.6)] backdrop-blur-sm">
            <KeyRound className="h-7 w-7 text-violet-300" aria-hidden />
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Shield className="h-3 w-3" aria-hidden />
            {badge}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-8 shadow-2xl shadow-violet-950/40 backdrop-blur-xl">
          {children}
        </div>

        <p className="mt-8 text-center">
          <Link
            href={backHref}
            className="text-sm font-medium text-zinc-400 transition-colors hover:text-violet-300"
          >
            {backLabel}
          </Link>
        </p>
      </div>
    </div>
  )
}
