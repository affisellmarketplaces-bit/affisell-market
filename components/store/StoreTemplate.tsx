"use client"

import Image from "next/image"
import Link from "next/link"
import { Check, Copy, Zap } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { BoostBanner } from "@/components/store/BoostBanner"
import type { AppLocale } from "@/lib/i18n-locale"
import { intlLocaleTag } from "@/lib/i18n-ui-locale"
import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { canShowLegionPayout24hBadge } from "@/lib/legion/split"

export type LegionStoreProduct = {
  id: string
  name: string
  imageUrl: string | null
  priceCents: number
  href: string
}

export type LegionStoreProfileView = {
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  tiktokUrl: string | null
  instagramUrl: string | null
  totalSales: number
}

type Props = {
  profile: LegionStoreProfileView
  products: LegionStoreProduct[]
  referralRef?: string | null
}

export function StoreTemplate({ profile, products, referralRef }: Props) {
  const t = useTranslations("legion")
  const locale = useLocale() as AppLocale
  const [copied, setCopied] = useState(false)
  const shopUrl = useMemo(() => {
    if (typeof window === "undefined") return `/${profile.username}`
    return `${window.location.origin}/${profile.username}`
  }, [profile.username])

  const avatar =
    profile.avatarUrl?.trim() ||
    `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(profile.username)}`

  function formatEur(cents: number): string {
    return new Intl.NumberFormat(intlLocaleTag(locale), {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100)
  }

  async function copyShop() {
    try {
      await navigator.clipboard.writeText(shopUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      console.log("[legion]", { username: profile.username, result: "copy_shop" })
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-800">
            Affisell
          </Link>
          <p className="truncate text-xs font-medium text-zinc-500">@{profile.username}</p>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher className="scale-90 [&_button]:border-zinc-200 [&_button]:bg-white [&_button]:text-zinc-800" />
            <button
              type="button"
              onClick={() => void copyShop()}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? t("copied") : t("copyLink")}
            </button>
          </div>
        </div>
      </header>

      <BoostBanner />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <section className="relative overflow-hidden rounded-[28px] border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50 to-cyan-50/40 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] sm:p-10">
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-cyan-400/15 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="relative size-24 overflow-hidden rounded-[22px] border border-white bg-zinc-100 shadow-lg sm:size-28">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt="" className="size-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700/80">
                {t("shop")}
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-[-0.03em] text-zinc-950 sm:text-5xl">
                {profile.displayName}
              </h1>
              {profile.bio ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                  {profile.bio}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {canShowLegionPayout24hBadge(profile.totalSales) ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                    <Zap className="size-3" aria-hidden />
                    {t("payout24h")}
                  </span>
                ) : null}
                {profile.totalSales > 0 ? (
                  <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium text-zinc-700">
                    {profile.totalSales === 1
                      ? t("salesOne", { count: profile.totalSales })
                      : t("salesMany", { count: profile.totalSales })}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {referralRef ? (
          <div className="mt-6 rounded-[20px] bg-zinc-950 px-5 py-4 text-white shadow-lg">
            <p className="text-sm font-medium text-white/80">
              {t("invitedBy", { username: referralRef })}
            </p>
            <Link
              href={`/onboarding/affiliate?ref=${encodeURIComponent(referralRef)}`}
              className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-cyan-50"
            >
              {t("join")}
            </Link>
          </div>
        ) : null}

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{t("selection")}</h2>
          {products.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">{t("emptyProducts")}</p>
          ) : (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {products.map((p) => (
                <li key={p.id}>
                  <Link
                    href={p.href}
                    className="group block overflow-hidden rounded-[20px] border border-zinc-200/90 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt=""
                          fill
                          className="object-cover transition duration-300 group-hover:scale-[1.03]"
                          sizes="(max-width: 640px) 50vw, 25vw"
                          unoptimized={
                            p.imageUrl.includes("localhost") || p.imageUrl.startsWith("data:")
                          }
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-300">—</div>
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-sm font-medium tracking-tight text-zinc-900">
                        {p.name}
                      </p>
                      <p className="text-sm font-bold tabular-nums text-zinc-950">
                        {formatEur(p.priceCents)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-4 py-6 text-center text-[11px] leading-relaxed text-zinc-500 sm:px-6">
        <p>
          {AFFISELL_LEGAL_IDENTITY.commercialName} — {AFFISELL_LEGAL_IDENTITY.legalName} · SIRET{" "}
          {AFFISELL_LEGAL_IDENTITY.siret} · {AFFISELL_LEGAL_IDENTITY.vatRegimeFr}
        </p>
        <p className="mt-1">{AFFISELL_LEGAL_IDENTITY.address}</p>
      </footer>
    </div>
  )
}
