"use client"

import Link from "next/link"
import { Loader2, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  type?: "submit" | "button"
  href?: string
  className?: string
}

export function PasswordResetCtaButton({
  children,
  loading = false,
  disabled = false,
  type = "submit",
  href,
  className,
}: Props) {
  const shellClass = cn(
        "group relative w-full overflow-hidden rounded-2xl p-px transition-transform duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:saturate-50",
    !disabled && !loading && "hover:scale-[1.02] active:scale-[0.99]",
    className
  )

  const inner = (
    <>
      <span
        className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 opacity-90 blur-md transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-600/40 via-fuchsia-500/30 to-cyan-400/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <span className="relative flex min-h-[52px] items-center justify-center gap-2.5 rounded-[15px] bg-zinc-950/95 px-6 py-3.5 text-sm font-semibold tracking-wide text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          aria-hidden
        />
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-200" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0 text-fuchsia-200" aria-hidden />
        )}
        <span className="relative">{children}</span>
      </span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={shellClass}>
        {inner}
      </Link>
    )
  }

  return (
    <button type={type} disabled={disabled || loading} className={shellClass}>
      {inner}
    </button>
  )
}
