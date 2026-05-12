"use client"

import Link from "next/link"
import { ExternalLink, Palette, Save, Store } from "lucide-react"
import type { FormEvent } from "react"
import { useCallback, useEffect, useState } from "react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type StoreRow = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  bannerUrl: string | null
  description: string | null
}

type Props = {
  previewHref: string
}

export function SupplierStorefrontEditor({ previewHref }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [description, setDescription] = useState("")
  const [accent, setAccent] = useState("#7c3aed")
  const [primaryHex, setPrimaryHex] = useState("#000000")

  const hydrate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/store/me", { credentials: "include", cache: "no-store" })
      const json = (await res.json()) as { store?: StoreRow; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to load store")
      const st = json.store
      if (st) {
        setName(st.name)
        setLogoUrl(st.logoUrl ?? "")
        setBannerUrl(st.bannerUrl ?? "")
        setDescription(st.description ?? "")
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
      if (/^https?:\/\//i.test(logoUrl.trim())) fd.set("logoUrl", logoUrl.trim())
      fd.set("customDomain", "")

      const res = await fetch("/api/store/update", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not save")
      setMessage("Storefront saved.")
      await hydrate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  if (loading && !name) {
    return (
      <BentoShell>
        <BentoContainer maxWidth="4xl">
          <BentoCard className="py-12 text-center text-sm text-gray-600 dark:text-zinc-400">Loading…</BentoCard>
        </BentoContainer>
      </BentoShell>
    )
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <BentoPageHeading
            eyebrow="Branding"
            title="Customize my storefront"
            description="Update how your shop looks to visitors: name, banner, description, and a live preview."
            className="max-w-2xl"
          />
          <Link
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
            )}
          >
            <ExternalLink className="size-5" aria-hidden />
            Preview live
          </Link>
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

        <BentoCard>
          <form onSubmit={onSubmit} className="space-y-8">
            <div className="space-y-2">
              <label htmlFor="sf-name" className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Store name
              </label>
              <Input id="sf-name" bento value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <label htmlFor="sf-banner" className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Banner (URL, 1920×400 recommended)
              </label>
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                <Input
                  id="sf-banner"
                  bento
                  type="url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://… paste an image URL for now"
                  className="mx-auto max-w-lg bg-white dark:bg-zinc-950"
                />
                <p className="mt-3 text-xs text-gray-600 dark:text-zinc-500">
                  Paste an HTTPS URL. For logo files or CDN URLs, use Store profile or a hosted image link.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="sf-desc" className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Description
              </label>
              <textarea
                id="sf-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell customers about your brand…"
                className="flex min-h-[120px] w-full rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-sm text-gray-900 shadow-xs outline-none transition placeholder:text-gray-400 focus-visible:border-[#7C3AED]/40 focus-visible:ring-2 focus-visible:ring-[#7C3AED]/25 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-white"
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="sf-ac1" className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Primary color
                </label>
                <input
                  id="sf-ac1"
                  type="color"
                  value={primaryHex}
                  onChange={(e) => setPrimaryHex(e.target.value)}
                  className="h-12 w-full cursor-pointer rounded-xl border border-gray-200 bg-white dark:border-zinc-700"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="sf-ac2" className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Accent color
                </label>
                <input
                  id="sf-ac2"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-12 w-full cursor-pointer rounded-xl border border-gray-200 bg-white dark:border-zinc-700"
                />
                <p className="text-xs text-gray-500 dark:text-zinc-500">Demo UI — theme persistence coming later.</p>
              </div>
            </div>

            <Button type="submit" variant="bentoSolid" size="bento" disabled={saving} className="w-full sm:w-auto">
              <Save className="size-5" aria-hidden />
              {saving ? "Saving…" : "Save storefront"}
            </Button>
          </form>
        </BentoCard>

        <BentoCard className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED]">
            <Store className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tip</p>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              Logo and slug live in{" "}
              <Link href="/dashboard/supplier/settings/store" className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
                Store profile
              </Link>
              .
            </p>
          </div>
          <Palette className="ml-auto hidden size-8 text-gray-300 sm:block dark:text-zinc-600" aria-hidden />
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
