"use client"

import Link from "next/link"
import type { FormEvent } from "react"
import { useCallback, useEffect, useState } from "react"

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
      setMessage("Vitrine sauvegardée.")
      await hydrate()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  if (loading && !name) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-zinc-500">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Personnaliser ma vitrine</h1>
        <Link
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-black px-4 py-2 text-white transition hover:bg-zinc-800"
        >
          Prévisualiser →
        </Link>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="sf-name" className="mb-2 block text-sm font-medium text-zinc-800">
            Nom de la boutique
          </label>
          <input
            id="sf-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-4 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
        </div>

        <div>
          <label htmlFor="sf-banner" className="mb-2 block text-sm font-medium text-zinc-800">
            Bannière (URL, 1920×400 recommandé)
          </label>
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <input
              id="sf-banner"
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://… ou glisser/déposer équivalent (URL pour l’instant)"
              className="mx-auto w-full max-w-lg rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <p className="mt-3 text-xs text-zinc-500">
              Collez une URL HTTPS. Upload fichier via la page Store profile pour le logo ou une URL CDN.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="sf-desc" className="mb-2 block text-sm font-medium text-zinc-800">
            Description
          </label>
          <textarea
            id="sf-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-4 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="Présentez votre marque..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sf-ac1" className="mb-2 block text-sm font-medium text-zinc-800">
              Couleur principale
            </label>
            <input
              id="sf-ac1"
              type="color"
              value={primaryHex}
              onChange={(e) => setPrimaryHex(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white"
            />
          </div>
          <div>
            <label htmlFor="sf-ac2" className="mb-2 block text-sm font-medium text-zinc-800">
              Couleur accent
            </label>
            <input
              id="sf-ac2"
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white"
            />
            <p className="mt-1 text-[10px] text-zinc-400">Demo UI — persist via thème futur.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-black py-3 font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
      </form>
    </div>
  )
}
