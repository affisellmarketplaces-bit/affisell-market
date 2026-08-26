"use client"

import { useState } from "react"
import { Loader2, Shield } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const REPORT_TYPES = [
  { value: "illicite", label: "Contenu illicite" },
  { value: "contrefacon", label: "Contrefaçon" },
  { value: "dangereux", label: "Produit dangereux" },
  { value: "trompeur", label: "Pratique trompeuse" },
  { value: "autre", label: "Autre" },
] as const

export function DsaSignalementForm() {
  const [email, setEmail] = useState("")
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]["value"]>("illicite")
  const [productUrl, setProductUrl] = useState("")
  const [description, setDescription] = useState("")
  const [proofUrls, setProofUrls] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const urls = proofUrls
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"))

    try {
      const res = await fetch("/api/legal/dsa-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterEmail: email.trim(),
          type,
          description: description.trim(),
          productUrl: productUrl.trim() || undefined,
          proofUrls: urls.length > 0 ? urls : undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setSuccess(
        data.message ??
          "Signalement reçu, réponse sous 24 h conformément à l'art. 16 DSA."
      )
      setDescription("")
      setProofUrls("")
      setProductUrl("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "submit_failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/30">
        <p className="font-semibold text-emerald-800 dark:text-emerald-200">Signalement enregistré</p>
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-100/90">{success}</p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/30">
        <Shield className="size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        <p className="text-sm text-violet-900 dark:text-violet-100">
          Point de contact DSA — Règlement (UE) 2022/2065, art. 16. Réponse substantielle sous 24 h.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Votre email *
        <input
          required
          type="email"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Type de signalement *
        <select
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        URL du produit (optionnel)
        <input
          type="url"
          placeholder="https://affisell.com/marketplace/..."
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Description détaillée *
        <textarea
          required
          minLength={20}
          rows={5}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Décrivez le contenu signalé, les faits et la base légale invoquée…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        URLs de preuves (optionnel, une par ligne)
        <textarea
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="https://…"
          value={proofUrls}
          onChange={(e) => setProofUrls(e.target.value)}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className={cn(buttonVariants({ size: "lg" }), "w-full bg-violet-700 hover:bg-violet-600")}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : "Envoyer le signalement"}
      </button>

      <p className="text-xs text-zinc-500">
        Affisell traite votre signalement conformément au DSA. Données traitées pour instruction du
        signalement uniquement (RGPD art. 6-1-c). Contact : legal@affisell.com
      </p>
    </form>
  )
}
