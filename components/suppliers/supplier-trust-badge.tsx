"use client"

import { cn } from "@/lib/utils"
import {
  coerceSupplierTrustTier,
  SUPPLIER_TRUST_TIER_META,
  type SupplierTrustTier,
} from "@/lib/supplier/supplier-trust-tier-shared"

type Size = "sm" | "md" | "lg" | "icon"

type Props = {
  tier?: SupplierTrustTier | string | null
  isVerifiedSupplier?: boolean
  locale?: "fr" | "en"
  size?: Size
  showLabel?: boolean
  className?: string
}

const SIZE: Record<Size, { icon: string; text: string; pad: string; gap: string }> = {
  icon: { icon: "size-5", text: "text-[0px]", pad: "p-0", gap: "gap-0" },
  sm: { icon: "size-4", text: "text-[10px]", pad: "px-2 py-0.5", gap: "gap-1" },
  md: { icon: "size-5", text: "text-xs", pad: "px-2.5 py-1", gap: "gap-1.5" },
  lg: { icon: "size-6", text: "text-sm", pad: "px-3 py-1.5", gap: "gap-2" },
}

export function OrbitalTrustIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="orbitalBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="45%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path
        fill="url(#orbitalBlue)"
        d="M12 1.8l1.45 2.98 3.28.48-2.37 2.31.56 3.27L12 9.77 8.08 11.84l.56-3.27L6.27 5.26l3.28-.48L12 1.8zm8.2 3.4l-.85 1.75 1.92.28-1.39 1.35.33 1.92-1.71-.9-1.71.9.33-1.92-1.39-1.35 1.92-.28-.85-1.75zm2.3 7.1l-1.4 1.02.53 3.08-2.77-1.46-2.77 1.46.53-3.08-1.4-1.02 2.77-.4 1.24-2.51 1.24 2.51 2.77.4zM12 22.2l-1.45-2.98-3.28-.48 2.37-2.31-.56-3.27L12 14.23l3.92 2.07-.56 3.27 2.37 2.31-3.28.48L12 22.2zM3.8 5.2l.85 1.75-1.92.28 1.39 1.35-.33 1.92 1.71-.9 1.71.9-.33-1.92 1.39-1.35-1.92-.28.85-1.75zm-2.3 7.1l1.4 1.02-.53 3.08 2.77-1.46 2.77 1.46-.53-3.08 1.4-1.02-2.77-.4-1.24-2.51-1.24 2.51-2.77.4z"
      />
      <circle cx="12" cy="12" r="6.2" fill="url(#orbitalBlue)" />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.6 12.1l2.1 2.1 4.7-4.8"
      />
    </svg>
  )
}

function SparkTrustIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="sparkAmber" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#sparkAmber)" opacity="0.95" />
      <path fill="#fff" d="M13 3.5 11.5 10H7l6.5 10.5L15 14h4.5L13 3.5z" />
    </svg>
  )
}

function ForgeTrustIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="forgeSilver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path
        fill="url(#forgeSilver)"
        d="M12 2 15.5 8.5 22 9.5 17 14.5 18.5 21 12 17.8 5.5 21 7 14.5 2 9.5 8.5 8.5 12 2z"
      />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M8.8 12.2l2.2 2.2 4.5-4.6"
      />
    </svg>
  )
}

function TrustIcon({ tier, className }: { tier: SupplierTrustTier; className?: string }) {
  if (tier === "ORBITAL") return <OrbitalTrustIcon className={className} />
  if (tier === "FORGE") return <ForgeTrustIcon className={className} />
  if (tier === "SPARK") return <SparkTrustIcon className={className} />
  return null
}

function shellClass(tier: SupplierTrustTier): string {
  if (tier === "ORBITAL") {
    return "border-sky-400/50 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 text-sky-900 shadow-sm shadow-sky-500/20 dark:border-sky-500/40 dark:text-sky-100"
  }
  if (tier === "FORGE") {
    return "border-violet-300/60 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 text-violet-900 dark:border-violet-600/50 dark:text-violet-100"
  }
  return "border-amber-300/60 bg-gradient-to-r from-amber-400/15 to-orange-500/10 text-amber-950 dark:border-amber-600/40 dark:text-amber-100"
}

export function SupplierTrustBadge({
  tier,
  isVerifiedSupplier,
  locale = "fr",
  size = "md",
  showLabel = true,
  className,
}: Props) {
  const resolved = coerceSupplierTrustTier(tier, isVerifiedSupplier)
  if (resolved === "NONE") return null

  const meta = SUPPLIER_TRUST_TIER_META[resolved]
  const s = SIZE[size]
  const label = locale === "fr" ? meta.shortFr : meta.shortEn
  const tooltip = locale === "fr" ? meta.tooltipFr : meta.tooltipEn

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold backdrop-blur-sm",
        shellClass(resolved),
        s.pad,
        s.gap,
        s.text,
        className
      )}
      title={tooltip}
      aria-label={tooltip}
    >
      <TrustIcon tier={resolved} className={cn(s.icon, "shrink-0 drop-shadow-sm")} />
      {showLabel && size !== "icon" ? <span>{label}</span> : null}
    </span>
  )
}

export function SupplierTrustBadgeHero({
  tier,
  locale = "fr",
  className,
}: {
  tier: SupplierTrustTier
  locale?: "fr" | "en"
  className?: string
}) {
  if (tier === "NONE") return null
  const meta = SUPPLIER_TRUST_TIER_META[tier]
  const title = locale === "fr" ? meta.labelFr : meta.labelEn
  const tooltip = locale === "fr" ? meta.tooltipFr : meta.tooltipEn
  const level = tier === "ORBITAL" ? "III" : tier === "FORGE" ? "II" : "I"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-5",
        tier === "ORBITAL"
          ? "border-sky-400/40 bg-gradient-to-br from-sky-500/15 via-blue-600/10 to-indigo-700/15"
          : tier === "FORGE"
            ? "border-violet-400/40 bg-gradient-to-br from-violet-500/10 to-indigo-600/10"
            : "border-amber-400/40 bg-gradient-to-br from-amber-400/15 to-orange-500/10",
        className
      )}
      title={tooltip}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl"
        aria-hidden
      />
      <div className="flex items-center gap-4">
        <TrustIcon tier={tier} className="size-14 shrink-0 drop-shadow-lg" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Trust Ladder · {level}
          </p>
          <p className="text-lg font-bold text-zinc-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{tooltip}</p>
        </div>
      </div>
    </div>
  )
}
