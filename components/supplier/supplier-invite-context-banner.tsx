"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { BadgePercent, Handshake, Loader2, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

type InviteContext = {
  status: string
  offeredCommissionPct: number | null
  categoryHint: string | null
  affiliateName: string
  affiliateSlug: string | null
  affiliateLogoUrl: string | null
  catalogLive: boolean
}

export function SupplierInviteContextBanner({
  fromInviteQuery,
  className,
}: {
  fromInviteQuery?: boolean
  className?: string
}) {
  const [ctx, setCtx] = useState<InviteContext | null>(null)
  const [loading, setLoading] = useState(Boolean(fromInviteQuery))

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/supplier/invitation-context", { cache: "no-store" })
        if (!res.ok) return
        const j = (await res.json()) as { invitation: InviteContext | null }
        if (!cancelled && j.invitation) setCtx(j.invitation)
      } catch {
        // offline / HMR — hide banner silently
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fromInviteQuery])

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden />
        <span className="text-sm text-emerald-900 dark:text-emerald-100">Chargement de votre invitation…</span>
      </div>
    )
  }

  if (!ctx) return null

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-white to-violet-50/80 px-4 py-4 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-violet-950/30 sm:px-5",
        className
      )}
      role="status"
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/80 bg-white shadow dark:border-zinc-700 dark:bg-zinc-900">
          {ctx.affiliateLogoUrl ? (
            <Image src={ctx.affiliateLogoUrl} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <Handshake className="h-5 w-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Collaboration avec {ctx.affiliateName}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {ctx.catalogLive
              ? "Votre premier produit est en ligne — les affiliés ont été notifiés."
              : "Publiez votre premier produit pour activer le réseau affilié et la vitrine de votre partenaire."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            {ctx.offeredCommissionPct != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium dark:bg-zinc-900">
                <BadgePercent className="h-3 w-3 text-emerald-600" aria-hidden />
                {ctx.offeredCommissionPct.toFixed(1)}% commission proposée
              </span>
            ) : null}
            {ctx.categoryHint ? (
              <span className="rounded-full bg-white/90 px-2 py-0.5 dark:bg-zinc-900">{ctx.categoryHint}</span>
            ) : null}
          </div>
        </div>
        {ctx.affiliateSlug ? (
          <Link
            href={`/store/${encodeURIComponent(ctx.affiliateSlug)}`}
            className="shrink-0 text-xs font-medium text-violet-700 hover:underline dark:text-violet-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir la vitrine partenaire →
          </Link>
        ) : null}
      </div>
    </div>
  )
}
