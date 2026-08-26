"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  FileText,
  Loader2,
  PenLine,
  ScrollText,
  Shield,
  Sparkles,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LegalDocRow = {
  id: string
  type: string
  title: string
  version: number
  status: string
  preview: string
  markdown?: string
  html?: string
}

type DocCard = {
  type: "cgv" | "cgu" | "mentions" | "contrat_fournisseur"
  label: string
  icon: typeof FileText
  fields: Array<{ key: string; label: string; type?: string; placeholder?: string }>
}

const DOC_CARDS: DocCard[] = [
  {
    type: "cgv",
    label: "CGV Marketplace",
    icon: ScrollText,
    fields: [
      { key: "companyName", label: "Nom société", placeholder: "Affisell" },
      { key: "marketplaceName", label: "Nom marketplace", placeholder: "Affisell Market" },
    ],
  },
  {
    type: "cgu",
    label: "CGU Utilisateurs",
    icon: Shield,
    fields: [],
  },
  {
    type: "mentions",
    label: "Mentions légales",
    icon: FileText,
    fields: [
      { key: "companyName", label: "Nom société" },
      { key: "siret", label: "SIRET" },
      { key: "adresse", label: "Adresse" },
    ],
  },
  {
    type: "contrat_fournisseur",
    label: "Contrat Fournisseur",
    icon: PenLine,
    fields: [
      { key: "supplierName", label: "Nom fournisseur" },
      { key: "commission", label: "Commission (%)", type: "number", placeholder: "10" },
      { key: "companyName", label: "Nom société" },
    ],
  },
]

export function LegalDocumentsPanel() {
  const [defaults, setDefaults] = useState<Record<string, Record<string, string | number>>>({})
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({})
  const [documents, setDocuments] = useState<LegalDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [preview, setPreview] = useState<LegalDocRow | null>(null)
  const [signEmail, setSignEmail] = useState("")
  const [signing, setSigning] = useState(false)
  const [lastSignUrl, setLastSignUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/avocat/documents", { cache: "no-store", credentials: "include" })
      const data = (await res.json()) as {
        ok?: boolean
        defaults?: typeof defaults
        documents?: LegalDocRow[]
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setDefaults(data.defaults ?? {})
      setDocuments(data.documents ?? [])
      const initialForms: Record<string, Record<string, string>> = {}
      for (const card of DOC_CARDS) {
        const d = (data.defaults ?? {}) as Record<string, Record<string, string | number>>
        const src =
          card.type === "cgv"
            ? d.cgv
            : card.type === "mentions"
              ? d.mentions
              : card.type === "contrat_fournisseur"
                ? d.contrat
                : {}
        initialForms[card.type] = Object.fromEntries(
          card.fields.map((f) => [f.key, String(src?.[f.key] ?? "")])
        )
      }
      setForms(initialForms)
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function generate(type: DocCard["type"]) {
    setGenerating(type)
    setError(null)
    try {
      const data = forms[type] ?? {}
      const payload =
        type === "contrat_fournisseur"
          ? { ...data, commission: Number(data.commission || 10) }
          : type === "cgu"
            ? {}
            : data
      const res = await fetch("/api/legal/avocat/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, data: payload }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        document?: LegalDocRow & { markdown: string; html: string }
        error?: string
      }
      if (!res.ok || !json.ok || !json.document) throw new Error(json.error ?? `HTTP ${res.status}`)
      setPreview({
        ...json.document,
        preview: json.document.markdown?.slice(0, 200) ?? "",
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "generate_failed")
    } finally {
      setGenerating(null)
    }
  }

  async function publish(id: string) {
    setError(null)
    const res = await fetch("/api/legal/avocat/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, action: "publish" }),
    })
    if (!res.ok) setError("publish_failed")
    await load()
  }

  async function requestSign(doc: LegalDocRow) {
    if (!signEmail.trim()) {
      setError("Email signataire requis")
      return
    }
    setSigning(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentId: doc.id,
          email: signEmail.trim(),
          signerName: forms.contrat_fournisseur?.supplierName,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; signingUrl?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setLastSignUrl(data.signingUrl ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign_request_failed")
    } finally {
      setSigning(false)
    }
  }

  const docsByType = useMemo(() => {
    const map = new Map<string, LegalDocRow[]>()
    for (const d of documents) {
      const list = map.get(d.type) ?? []
      list.push(d)
      map.set(d.type, list)
    }
    return map
  }, [documents])

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(180,83,9,0.25),transparent)]"
        aria-hidden
      />
      <BentoShell className="relative">
        <BentoContainer maxWidth="5xl" className="space-y-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BentoPageHeading
              eyebrow="Affisell · Conformité DSA"
              title="Documents légaux"
              description="CGV · CGU · Mentions · Contrats fournisseurs — génération GPT-4o + signature électronique."
            />
            <Link
              href="/dashboard/admin/legal"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-zinc-700")}
            >
              ← Avocat Numérique
            </Link>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>
          ) : null}

          {lastSignUrl ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              Lien signature :{" "}
              <a href={lastSignUrl} className="underline" target="_blank" rel="noreferrer">
                {lastSignUrl}
              </a>
            </p>
          ) : null}

          <ul className="grid gap-4 md:grid-cols-2">
            {DOC_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <li key={card.type}>
                  <BentoCard className="h-full border-zinc-800/80 bg-zinc-950/75 p-4">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-amber-400" aria-hidden />
                      <p className="font-semibold text-white">{card.label}</p>
                    </div>
                    {card.fields.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {card.fields.map((field) => (
                          <label key={field.key} className="block text-xs text-zinc-500">
                            {field.label}
                            <input
                              className="mt-1 w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                              type={field.type ?? "text"}
                              placeholder={field.placeholder}
                              value={forms[card.type]?.[field.key] ?? ""}
                              onChange={(e) =>
                                setForms((prev) => ({
                                  ...prev,
                                  [card.type]: { ...prev[card.type], [field.key]: e.target.value },
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">Génération automatique depuis identité Affisell.</p>
                    )}
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ size: "sm" }),
                        "mt-4 w-full gap-1.5 bg-gradient-to-r from-amber-700 to-amber-600"
                      )}
                      disabled={generating === card.type}
                      onClick={() => void generate(card.type)}
                    >
                      {generating === card.type ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Générer
                    </button>
                    {(docsByType.get(card.type) ?? []).slice(0, 2).map((doc) => (
                      <p key={doc.id} className="mt-2 text-[10px] text-zinc-500">
                        v{doc.version} · {doc.status}
                      </p>
                    ))}
                  </BentoCard>
                </li>
              )
            })}
          </ul>

          {preview ? (
            <BentoCard className="border-amber-500/25 bg-zinc-950/90 p-5">
              <p className="text-sm font-semibold text-amber-200">Preview — {preview.title}</p>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-amber-500/20 bg-black/50 p-4 text-xs text-amber-100/90">
                {preview.markdown ?? preview.preview}
              </pre>
            </BentoCard>
          ) : null}

          <BentoCard className="border-zinc-800 bg-zinc-950/90 p-5">
            <p className="text-sm font-semibold text-white">Versions</p>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-zinc-500" />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="py-2">Document</th>
                      <th className="py-2">Version</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-t border-zinc-800/80">
                        <td className="py-3">
                          <p className="font-medium text-zinc-200">{doc.title}</p>
                          <p className="text-[10px] text-zinc-500">{doc.type}</p>
                        </td>
                        <td className="py-3 font-mono text-xs">{doc.version}</td>
                        <td className="py-3 text-xs uppercase text-zinc-400">{doc.status}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-[10px]")}
                              onClick={() =>
                                void fetch(`/api/legal/avocat/documents?id=${doc.id}`, { credentials: "include" })
                                  .then((r) => r.json())
                                  .then((j: { document?: LegalDocRow & { markdown: string } }) => {
                                    if (j.document) setPreview(j.document)
                                  })
                              }
                            >
                              Voir
                            </button>
                            {doc.status === "draft" ? (
                              <button
                                type="button"
                                className={cn(buttonVariants({ size: "sm" }), "h-7 text-[10px] bg-amber-800")}
                                onClick={() => void publish(doc.id)}
                              >
                                Publier
                              </button>
                            ) : null}
                            {doc.type === "contrat_fournisseur" && doc.status === "published" ? (
                              <button
                                type="button"
                                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-7 text-[10px]")}
                                disabled={signing}
                                onClick={() => void requestSign(doc)}
                              >
                                Signer
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-4">
              <label className="text-xs text-zinc-500">
                Email signataire (contrat fournisseur)
                <input
                  className="mt-1 block w-64 rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  type="email"
                  placeholder="supplier@example.com"
                  value={signEmail}
                  onChange={(e) => setSignEmail(e.target.value)}
                />
              </label>
            </div>
          </BentoCard>
        </BentoContainer>
      </BentoShell>
    </div>
  )
}
