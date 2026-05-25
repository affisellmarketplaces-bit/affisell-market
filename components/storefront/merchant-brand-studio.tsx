"use client"

import Link from "next/link"
import { ExternalLink, Palette, Save, Sparkles } from "lucide-react"
import type { FormEvent } from "react"
import { useCallback, useEffect, useState } from "react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { StoreCustomDomainCard } from "@/components/storefront/store-custom-domain-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [publicStoreUrl, setPublicStoreUrl] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [description, setDescription] = useState("")
  const [accent, setAccent] = useState(DEFAULT_STOREFRONT_THEME.accent!)
  const [primaryHex, setPrimaryHex] = useState(DEFAULT_STOREFRONT_THEME.primary!)

  const hydrate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/store/me", { credentials: "include", cache: "no-store" })
      const json = (await res.json()) as {
        store?: StoreRow
        publicStoreUrl?: string
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to load store")
      if (json.publicStoreUrl) setPublicStoreUrl(json.publicStoreUrl)
      const st = json.store
      if (st) {
        setName(st.name)
        setBannerUrl(st.bannerUrl ?? "")
        setDescription(st.description ?? "")
        const theme = parseStorefrontTheme(st.storefrontTheme)
        setAccent(theme.accent ?? DEFAULT_STOREFRONT_THEME.accent!)
        setPrimaryHex(theme.primary ?? DEFAULT_STOREFRONT_THEME.primary!)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

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

      const res = await fetch("/api/store/update", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not save")
      setMessage("Brand saved — your public storefront is updated.")
      await hydrate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  const eyebrow = role === "AFFILIATE" ? "Creator brand" : "Supplier brand"
  const title = role === "AFFILIATE" ? "Brand Studio" : "Storefront studio"
  const desc =
    role === "AFFILIATE"
      ? "Your public shop on Affisell and on your own domain — banner, colors, and copy in one place."
      : "How buyers see your supplier shop: banner, brand colors, and custom domain."

  if (loading && !name) {
    return (
      <BentoShell>
        <BentoContainer maxWidth="5xl">
          <BentoCard className="py-16 text-center text-sm text-gray-600 dark:text-zinc-400">Loading…</BentoCard>
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
                Live URL
              </a>
            ) : null}
            <Link
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <ExternalLink className="size-4" aria-hidden />
              Preview on Affisell
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
                  Store name
                </label>
                <Input id="bs-name" bento value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <label htmlFor="bs-banner" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Hero banner (HTTPS URL)
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
                  Tagline / description
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
                    Primary
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
                    Accent
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

              <Button type="submit" variant="bentoSolid" size="bento" disabled={saving}>
                <Save className="size-5" aria-hidden />
                {saving ? "Saving…" : "Save brand"}
              </Button>
            </form>
          </BentoCard>

          <div className="space-y-4">
            <StoreCustomDomainCard variant="studio" />
            <BentoCard className="text-sm text-gray-600 dark:text-zinc-400">
              <p className="flex items-center gap-2 font-medium text-gray-900 dark:text-zinc-100">
                <Palette className="size-4 text-violet-600" aria-hidden />
                Logo &amp; logistics
              </p>
              <p className="mt-2">
                Upload logo, AI avatar, ship-from address, and slug in{" "}
                <Link href={profileHref} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
                  {profileLabel}
                </Link>
                .
              </p>
            </BentoCard>
          </div>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
