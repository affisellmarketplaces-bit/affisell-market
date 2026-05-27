"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import { formatAffiliateListingDescriptionFromAi } from "@/lib/affiliate-product-generate-description"
import type { ProductDescriptionAiResult } from "@/lib/affiliate-product-generate-description"

type ListingPayload = {
  listing: {
    id: string
    productId: string
    customTitle: string | null
    customDescription: string | null
    seoTitle: string | null
    seoDescription: string | null
    isListed: boolean
  }
  product: {
    id: string
    name: string
    description: string
    images: string[]
    attributes?: Array<{ key: string; label: string; value: string }>
  }
}

export function AffiliateProductEditForm() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const listingId = params?.id ?? ""

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ListingPayload | null>(null)

  const [customTitle, setCustomTitle] = useState("")
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")
  const [customDescription, setCustomDescription] = useState("")
  const [aiPreview, setAiPreview] = useState<ProductDescriptionAiResult | null>(null)

  const load = useCallback(async () => {
    if (!listingId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/affiliate/products/${encodeURIComponent(listingId)}`, {
        credentials: "include",
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Listing introuvable")
      }
      const data = (await res.json()) as ListingPayload
      setPayload(data)
      setCustomTitle(data.listing.customTitle ?? "")
      setSeoTitle(data.listing.seoTitle ?? "")
      setSeoDescription(data.listing.seoDescription ?? "")
      setCustomDescription(data.listing.customDescription ?? data.product.description ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    void load()
  }, [load])

  const handleGenerate = useCallback(async () => {
    if (!payload?.product.id) return
    setAiLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/products/${encodeURIComponent(payload.product.id)}/generate-description`,
        { method: "POST", credentials: "include" }
      )
      const data = (await res.json()) as ProductDescriptionAiResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Génération impossible")

      setAiPreview(data)
      setSeoTitle(data.seoTitle.slice(0, 60))
      setSeoDescription(data.accroche.slice(0, 160))
      setCustomDescription(formatAffiliateListingDescriptionFromAi(data))
      if (!customTitle.trim()) {
        setCustomTitle(data.seoTitle.slice(0, 200))
      }
      toast.success("Description IA générée — vérifiez puis enregistrez")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "IA indisponible")
    } finally {
      setAiLoading(false)
    }
  }, [customTitle, payload?.product.id])

  const handleSave = useCallback(async () => {
    if (!listingId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/affiliate/products/${encodeURIComponent(listingId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customTitle: customTitle.trim() || null,
          customDescription: customDescription.trim(),
          seoTitle: seoTitle.trim(),
          seoDescription: seoDescription.trim(),
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Enregistrement impossible")
      }
      toast.success("Listing enregistré")
      router.push("/dashboard/affiliate?tab=store")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }, [customDescription, customTitle, listingId, router, seoDescription, seoTitle])

  if (loading) {
    return (
      <BentoShell>
        <BentoContainer>
          <BentoCard className="py-12 text-center text-sm text-zinc-500">Chargement…</BentoCard>
        </BentoContainer>
      </BentoShell>
    )
  }

  if (error && !payload) {
    return (
      <BentoShell>
        <BentoContainer>
          <BentoCard className="py-12 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Link href="/dashboard/affiliate" className="mt-4 inline-block text-sm text-violet-600 hover:underline">
              Retour au dashboard
            </Link>
          </BentoCard>
        </BentoContainer>
      </BentoShell>
    )
  }

  const productName = payload?.product.name ?? "Produit"

  return (
    <BentoShell>
      <BentoContainer className="max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/affiliate?tab=store"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour à ma boutique
          </Link>
          <Button
            type="button"
            disabled={aiLoading || saving}
            onClick={() => void handleGenerate()}
            className="gap-2 bg-gradient-to-r from-cyan-600 via-violet-600 to-fuchsia-600 text-white hover:opacity-95"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Générer avec IA
          </Button>
        </div>

        <BentoCard className="space-y-6 p-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Éditer le listing</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {productName} — copy optimisée conversion (GPT-4o). N&apos;impacte pas la catégorie catalogue.
            </p>
          </div>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div>
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Titre boutique</label>
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={productName}
              maxLength={200}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">SEO Title</label>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value.slice(0, 60))}
              maxLength={60}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="mt-1 text-[11px] text-zinc-500">{seoTitle.length}/60</p>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Accroche SEO</label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value.slice(0, 160))}
              rows={2}
              maxLength={160}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="mt-1 text-[11px] text-zinc-500">{seoDescription.length}/160</p>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Description boutique</label>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              rows={14}
              maxLength={16000}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 font-mono text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          {aiPreview ? (
            <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Aperçu IA
              </p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {aiPreview.benefices.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
              {aiPreview.faq.length > 0 ? (
                <div className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {aiPreview.faq.map((f) => (
                    <div key={f.q}>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{f.q}</p>
                      <p>{f.a}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => router.push("/dashboard/affiliate?tab=store")}>
              Annuler
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
          </div>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
