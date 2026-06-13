"use client"

import Link from "next/link"
import { ExternalLink, Palette, Save, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import type { FormEvent } from "react"
import { useCallback, useEffect, useState } from "react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { StoreCustomDomainCard } from "@/components/storefront/store-custom-domain-card"
import { StoreLiveUrlCard } from "@/components/storefront/store-live-url-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { StoreNameBadgePicker } from "@/components/storefront/store-name-badge-picker"
import {
  DEFAULT_STORE_NAME_BADGE,
  type StoreNameBadgeStyle,
} from "@/lib/store-name-badge-styles"
import {
  DEFAULT_STOREFRONT_THEME,
  parseStorefrontTheme,
} from "@/lib/storefront-theme-shared"

type MerchantRole = "AFFILIATE" | "SUPPLIER"

type StoreRow = {
  name: string
  slug: string
  logoUrl: string | null
  bannerUrl: string | null
  description: string | null
  storefrontTheme?: unknown
}

type Props = {
  role: MerchantRole
  previewHref: string
  profileHref: string
  profileLabel: string
}

export function MerchantBrandStudio({ role, previewHref, profileHref, profileLabel }: Props) {
  const t = useTranslations("storefront.brandStudio")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [publicStoreUrl, setPublicStoreUrl] = useState<string | null>(null)
  const [storeUrls, setStoreUrls] = useState<{
    primaryUrl: string
    subdomainUrl: string
    platformPathUrl: string
    customDomainUrl: string | null
  } | null>(null)
  const [storeHostSuffix, setStoreHostSuffix] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [description, setDescription] = useState("")
  const [accent, setAccent] = useState(DEFAULT_STOREFRONT_THEME.accent!)
  const [primaryHex, setPrimaryHex] = useState(DEFAULT_STOREFRONT_THEME.primary!)
  const [nameBadge, setNameBadge] = useState<StoreNameBadgeStyle>(DEFAULT_STORE_NAME_BADGE)

  const hydrate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/store/me", { credentials: "include", cache: "no-store" })
      const json = (await res.json()) as {
        store?: StoreRow
        publicStoreUrl?: string
        storeUrls?: {
          primaryUrl: string
          subdomainUrl: string
          platformPathUrl: string
          customDomainUrl: string | null
        }
        storeHostSuffix?: string | null
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? t("loadFailed"))
      if (json.publicStoreUrl) setPublicStoreUrl(json.publicStoreUrl)
      if (json.storeUrls) setStoreUrls(json.storeUrls)
      setStoreHostSuffix(json.storeHostSuffix ?? null)
      const st = json.store
      if (st) {
        setName(st.name)
        setBannerUrl(st.bannerUrl ?? "")
        setDescription(st.description ?? "")
        const theme = parseStorefrontTheme(st.storefrontTheme)
        setAccent(theme.accent ?? DEFAULT_STOREFRONT_THEME.accent!)
        setPrimaryHex(theme.primary ?? DEFAULT_STOREFRONT_THEME.primary!)
        setNameBadge(theme.nameBadge ?? DEFAULT_STORE_NAME_BADGE)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.set("name", name.trim().slice(0, 40))
      fd.set("description", description)
      fd.set("bannerUrl", bannerUrl.trim())
      fd.set("themePrimary", primaryHex)
      fd.set("themeAccent", accent)
      fd.set("themeNameBadge", nameBadge)

      const res = await fetch("/api/store/update", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? t("saveFailed"))
      setMessage(t("saved"))
      await hydrate()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const eyebrow = role === "AFFILIATE" ? t("affiliateEyebrow") : t("supplierEyebrow")
  const title = role === "AFFILIATE" ? t("affiliateTitle") : t("supplierTitle")
  const desc = role === "AFFILIATE" ? t("affiliateDescription") : t("supplierDescription")

  if (loading && !name) {
    return (
      <BentoShell>
        <BentoContainer maxWidth="5xl">
          <BentoCard className="py-16 text-center text-sm text-gray-600 dark:text-zinc-400">{t("loading")}</BentoCard>
        </BentoContainer>
      </BentoShell>
    )
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-8 pb-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <BentoPageHeading
            eyebrow={eyebrow}
            title={title}
            description={desc}
            className="max-w-2xl"
          />
          <div className="flex flex-wrap gap-2">
            {publicStoreUrl ? (
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100"
                )}
              >
                <Sparkles className="size-4" aria-hidden />
                {t("liveUrl")}
              </a>
            ) : null}
            <Link
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t("previewAffisell")}
            </Link>
          </div>
        </div>

        {error ? (
          <BentoCard className="border-rose-200 bg-rose-50/80 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </BentoCard>
        ) : null}
        {message ? (
          <BentoCard className="border-emerald-200 bg-emerald-50/80 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            {message}
          </BentoCard>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,22rem)]">
          <BentoCard>
            <form onSubmit={onSubmit} className="space-y-8">
              <div className="space-y-2">
                <label htmlFor="bs-name" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t("storeName")}
                </label>
                <Input id="bs-name" bento value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <label htmlFor="bs-banner" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t("heroBanner")}
                </label>
                <Input
                  id="bs-banner"
                  bento
                  type="url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="bs-desc" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t("tagline")}
                </label>
                <textarea
                  id="bs-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="flex min-h-[100px] w-full rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="bs-primary" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t("primary")}
                  </label>
                  <input
                    id="bs-primary"
                    type="color"
                    value={primaryHex}
                    onChange={(e) => setPrimaryHex(e.target.value)}
                    className="h-11 w-full cursor-pointer rounded-xl border border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="bs-accent" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t("accent")}
                  </label>
                  <input
                    id="bs-accent"
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-11 w-full cursor-pointer rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div
                className="h-20 rounded-2xl shadow-inner"
                style={{
                  background: `linear-gradient(120deg, ${primaryHex}, ${accent})`,
                }}
                aria-hidden
              />

              <StoreNameBadgePicker
                value={nameBadge}
                onChange={setNameBadge}
                previewName={name.trim() || "Ecom Store"}
                accent={accent}
                primary={primaryHex}
              />

              <Button type="submit" variant="bentoSolid" size="bento" disabled={saving}>
                <Save className="size-5" aria-hidden />
                {saving ? t("saving") : t("saveBrand")}
              </Button>
            </form>
          </BentoCard>

          <div className="space-y-4">
            <StoreLiveUrlCard urls={storeUrls} storeHostSuffix={storeHostSuffix} loading={loading} />
            <StoreCustomDomainCard variant="studio" />
            <BentoCard className="text-sm text-gray-600 dark:text-zinc-400">
              <p className="flex items-center gap-2 font-medium text-gray-900 dark:text-zinc-100">
                <Palette className="size-4 text-violet-600" aria-hidden />
                {t("logoLogisticsTitle")}
              </p>
              <p className="mt-2">
                {t.rich("logoLogisticsBody", {
                  profileLink: () => (
                    <Link
                      href={profileHref}
                      className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                    >
                      {profileLabel}
                    </Link>
                  ),
                })}
              </p>
            </BentoCard>
          </div>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
