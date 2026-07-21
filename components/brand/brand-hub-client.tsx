"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useTransition } from "react"
import { Check, Copy, Download, ExternalLink, Radar } from "lucide-react"

import {
  BIO_COPY_BLOCKS,
  BRAND,
  LOGO_ASSETS,
  SOCIAL_PROFILE_LIST,
  type SocialProfile,
  type SocialTier,
} from "@/lib/brand/social-profiles"
import { cn } from "@/lib/utils"

const TIER_LABEL: Record<SocialTier, string> = {
  must: "Tier 1 · Must",
  growth: "Tier 2 · Growth",
  global: "Tier 3 · Global",
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function CopyButton({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const [, startTransition] = useTransition()

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10",
        className
      )}
      onClick={() => {
        startTransition(() => {
          void copyText(value).then((ok) => {
            if (!ok) return
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          })
        })
      }}
    >
      {copied ? <Check className="size-3.5 text-emerald-400" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copié" : label}
    </button>
  )
}

function SocialCard({ profile }: { profile: SocialProfile }) {
  const payload = `${profile.handle}\n${profile.bio}\n${BRAND.links.radar}`

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{profile.name}</p>
          <p className="mt-0.5 font-mono text-xs text-violet-300">{profile.handle}</p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          Prêt
        </span>
      </div>
      <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-400">{profile.bio}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton label="Connecter" value={payload} className="bg-[#6D28D9]/20 border-[#6D28D9]/40 hover:bg-[#6D28D9]/30" />
        <a
          href={profile.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
        >
          Ouvrir <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
    </article>
  )
}

export function BrandHubClient() {
  const byTier = (tier: SocialTier) => SOCIAL_PROFILE_LIST.filter((p) => p.tier === tier)

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/affisell-mark.svg"
              alt="Affisell"
              width={36}
              height={36}
              className="rounded-lg"
              priority
            />
            <div>
              <p className="text-sm font-semibold tracking-tight">Affisell</p>
              <p className="text-xs text-zinc-500">Brand Assets</p>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-xs text-zinc-400">
            <Link href="/radar" className="hover:text-white">
              World Radar
            </Link>
            <Link href="/press" className="hover:text-white">
              Press
            </Link>
            <a
              href="/brand/affisell-press-kit.zip"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#6D28D9] px-3 py-1.5 font-medium text-white hover:bg-[#5B21B6]"
            >
              <Download className="size-3.5" aria-hidden />
              Press kit
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
        <section className="max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6D28D9]">Brand Hub</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Profils prêts à connecter.
            <span className="block text-zinc-500">
              {SOCIAL_PROFILE_LIST.length} réseaux. Une voix Bloomberg.
            </span>
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
            {BRAND.mission}. {BRAND.taglineEn} — {BRAND.taglineGlobal}
          </p>
          <div className="flex flex-wrap gap-2">
            {BRAND.hashtags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Section 1 — Logos */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">1 · Logo pack</h2>
            <p className="mt-1 text-sm text-zinc-500">SVG couleur, blanc, noir — usage presse & réseaux.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LOGO_ASSETS.map((asset) => (
              <a
                key={asset.href}
                href={asset.href}
                download
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-[#6D28D9]/50"
              >
                <div>
                  <p className="text-sm font-medium text-white">{asset.label}</p>
                  <p className="text-xs text-zinc-500">{asset.format}</p>
                </div>
                <Download className="size-4 text-zinc-500 group-hover:text-[#A78BFA]" aria-hidden />
              </a>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/10 bg-[#111113] p-6">
            <Image src="/brand/affisell-mark.svg" alt="" width={64} height={64} className="rounded-xl" />
            <Image src="/brand/affisell-mark-white.svg" alt="" width={64} height={64} className="rounded-xl" />
            <Image src="/brand/affisell-mark-black.svg" alt="" width={64} height={64} className="rounded-xl border border-zinc-200" />
            <div className="text-xs text-zinc-500">
              Primary <span className="font-mono text-white">{BRAND.colors.primary}</span> · BG{" "}
              <span className="font-mono text-white">{BRAND.colors.bg}</span>
            </div>
          </div>
        </section>

        {/* Section 2 — Screenshots / Radar */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">2 · World Radar · 31 pays</h2>
            <p className="mt-1 text-sm text-zinc-500">Capture live du terminal — 620 winners / jour.</p>
          </div>
          <Link
            href="/radar"
            className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#6D28D9]/30 via-[#0A0A0B] to-zinc-900 p-8 sm:p-12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(109,40,217,0.25),_transparent_55%)]" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
                  <Radar className="size-4" aria-hidden />
                  Live terminal
                </p>
                <p className="text-2xl font-semibold tracking-tight">{BRAND.taglineGlobal}</p>
                <p className="max-w-md text-sm text-zinc-400">
                  Ouvre /radar pour screenshots presse (31 pays, scores, challengers).
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0A0A0B] transition group-hover:bg-violet-100">
                Ouvrir World Radar <ExternalLink className="size-4" aria-hidden />
              </span>
            </div>
          </Link>
        </section>

        {/* Section 3 — Bios copy */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">3 · Bios copier-coller</h2>
            <p className="mt-1 text-sm text-zinc-500">Longueurs adaptées Instagram, TikTok, X, LinkedIn, YouTube, PH.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {BIO_COPY_BLOCKS.map((block) => (
              <div key={block.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{block.label}</p>
                  <CopyButton label="Copy" value={block.text} />
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">{block.text}</p>
                <p className="mt-2 text-[10px] text-zinc-600">
                  {block.text.length}/{block.max} car
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4 — Social grid */}
        <section className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold">4 · Social links · Ready to connect</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Clique <strong className="font-medium text-zinc-300">Connecter</strong> pour copier handle + bio adaptée.
            </p>
          </div>
          {(["must", "growth", "global"] as const).map((tier) => (
            <div key={tier} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{TIER_LABEL[tier]}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byTier(tier).map((profile) => (
                  <SocialCard key={profile.id} profile={profile} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Section 5 — Press kit */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">5 · Press kit</h2>
            <p className="mt-1 text-sm text-zinc-500">Logos + brand kit markdown — ZIP prêt pour journalistes & partenaires.</p>
          </div>
          <a
            href="/brand/affisell-press-kit.zip"
            className="flex items-center justify-between gap-4 rounded-2xl border border-[#6D28D9]/40 bg-[#6D28D9]/10 px-6 py-5 transition hover:bg-[#6D28D9]/20"
          >
            <div>
              <p className="font-semibold text-white">affisell-press-kit.zip</p>
              <p className="text-sm text-zinc-400">Marks SVG · brand kit · assets press</p>
            </div>
            <Download className="size-5 text-[#A78BFA]" aria-hidden />
          </a>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-zinc-600">
        Tone: {BRAND.tone} · {BRAND.links.home}
      </footer>
    </div>
  )
}
