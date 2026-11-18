"use client"

import Image from "@/components/ui/safe-image"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { ExternalLink, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import type { ResellerImportDetail, ResellerImportReviewRow } from "@/lib/reseller-import/review.server"
import { ListingComplianceSection } from "@/components/supplier/listing-compliance/listing-compliance-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Filter = "pending" | "approved_awaiting_publication" | "legacy_unreviewed" | "rejected" | "all"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "À valider" },
  { id: "approved_awaiting_publication", label: "Approuvés — conformité à compléter" },
  { id: "legacy_unreviewed", label: "Anciens imports (non validés)" },
  { id: "rejected", label: "Refusés" },
  { id: "all", label: "Tous" },
]

const STATE_LABEL: Record<string, string> = {
  pending: "À valider",
  approved_awaiting_publication: "Approuvé — non publiable",
  legacy_unreviewed: "Ancien import — jamais validé",
  rejected: "Refusé",
  approved: "Approuvé",
}

const STATE_TONE: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  approved_awaiting_publication: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  legacy_unreviewed: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  rejected: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
  approved: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
}

/** French labels of the publication-gate codes (lib/listing-compliance/evaluate.ts). */
const ISSUE_LABEL: Record<string, string> = {
  gpsr_manufacturer_name_missing: "Nom du fabricant manquant",
  gpsr_manufacturer_address_missing: "Adresse du fabricant manquante",
  gpsr_manufacturer_email_missing: "E-mail du fabricant manquant",
  gpsr_manufacturer_email_invalid: "E-mail du fabricant invalide",
  gpsr_manufacturer_country_missing: "Pays du fabricant manquant",
  gpsr_manufacturer_country_invalid: "Pays du fabricant invalide",
  gpsr_eu_rep_name_missing: "Responsable UE : nom manquant",
  gpsr_eu_rep_address_missing: "Responsable UE : adresse manquante",
  gpsr_eu_rep_email_missing: "Responsable UE : e-mail manquant",
  gpsr_eu_rep_email_invalid: "Responsable UE : e-mail invalide",
  gtin_invalid: "Code-barres (GTIN) invalide",
  gtin_missing: "Code-barres (GTIN) absent",
  brand_missing: "Marque absente",
}

const ERROR_LABEL: Record<string, string> = {
  invalid_body: "Indiquez une raison d'au moins 3 caractères.",
  not_found: "Produit introuvable.",
  not_a_reseller_import: "Ce produit n'est pas un import revendeur.",
  transition_not_allowed: "Cette décision n'est pas possible dans l'état actuel.",
  not_approved: "L'import doit d'abord être approuvé.",
  already_live: "Ce produit est déjà en ligne.",
  compliance_blocking: "Publication refusée : des données de sécurité produit obligatoires manquent.",
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatEur(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function safeHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function AdminResellerImportsConsole({ initialRows }: { initialRows: ResellerImportReviewRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [filter, setFilter] = useState<Filter>("pending")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ResellerImportDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [note, setNote] = useState("")
  const [confirmReject, setConfirmReject] = useState(false)
  const [compliance, setCompliance] = useState<Record<string, string>>({})
  const [reloadTick, setReloadTick] = useState(0)
  const [pending, startTransition] = useTransition()

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved_awaiting_publication: 0, legacy_unreviewed: 0, rejected: 0 }
    for (const r of rows) c[r.state] = (c[r.state] ?? 0) + 1
    return c
  }, [rows])

  const visible = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.state === filter)), [rows, filter])

  const refresh = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/admin/reseller-imports", { credentials: "include" })
      if (!res.ok) {
        toast.error("Impossible de recharger la liste.")
        return
      }
      const json = (await res.json()) as { imports: ResellerImportReviewRow[] }
      setRows(json.imports)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    setConfirmReject(false)
    setNote("")
    fetch(`/api/admin/reseller-imports/${encodeURIComponent(selectedId)}`, { credentials: "include" })
      .then(async (res) => (res.ok ? ((await res.json()) as { import: ResellerImportDetail }).import : null))
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setCompliance(d?.complianceValues ?? {})
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, reloadTick])

  const decide = (decision: "approve" | "reject") => {
    if (!detail) return
    if (note.trim().length < 3) {
      toast.error(ERROR_LABEL.invalid_body)
      return
    }
    if (decision === "reject" && !confirmReject) {
      setConfirmReject(true)
      return
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/reseller-imports/${encodeURIComponent(detail.productId)}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        published?: boolean
        blocking?: string[]
        listedListings?: number
        unlistedListings?: number
      }
      if (!res.ok) {
        toast.error(ERROR_LABEL[json.error ?? ""] ?? "La décision n'a pas pu être enregistrée.")
        return
      }
      if (decision === "reject") toast.success(`Refusé — ${json.unlistedListings ?? 0} annonce(s) retirée(s).`)
      else if (json.published) toast.success(`Approuvé — produit publiable, ${json.listedListings ?? 0} annonce(s) mise(s) en ligne.`)
      else
        toast.warning(
          `Approuvé, mais NON publié : ${(json.blocking ?? []).map((c) => ISSUE_LABEL[c] ?? c).join(", ")}. Complétez ces données puis publiez.`
        )
      setSelectedId(null)
      refresh()
    })
  }

  const saveCompliance = () => {
    if (!detail) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/reseller-imports/${encodeURIComponent(detail.productId)}/compliance`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: compliance }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; ready?: boolean }
      if (!res.ok) {
        toast.error(ERROR_LABEL[json.error ?? ""] ?? "Les données n'ont pas pu être enregistrées.")
        return
      }
      toast.success(json.ready ? "Conformité complète." : "Enregistré — des données obligatoires manquent encore.")
      setReloadTick((n) => n + 1)
    })
  }

  const publish = () => {
    if (!detail) return
    if (note.trim().length < 3) {
      toast.error(ERROR_LABEL.invalid_body)
      return
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/reseller-imports/${encodeURIComponent(detail.productId)}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; listedListings?: number }
      if (!res.ok) {
        toast.error(ERROR_LABEL[json.error ?? ""] ?? "La publication a échoué.")
        return
      }
      toast.success(`Publié — ${json.listedListings ?? 0} annonce(s) mise(s) en ligne.`)
      setSelectedId(null)
      refresh()
    })
  }

  const liveListings = detail?.listings.filter((l) => l.isListed).length ?? 0
  const requestedListings = detail?.listings.filter((l) => l.listRequested).length ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-zinc-100">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">Catalogue</p>
          <h1 className="text-2xl font-bold">Imports URL des revendeurs</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Import → vérification → publication. Un produit importé reste en brouillon et ses annonces restent
            invisibles tant qu&apos;il n&apos;est pas approuvé ici. Chaque décision est journalisée avec sa raison.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={pending}>
          <RefreshCw className={cn("mr-2 h-4 w-4", pending && "animate-spin")} /> Actualiser
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              filter === f.id ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-white/10 text-zinc-400"
            )}
          >
            {f.label}
            {f.id !== "all" ? ` (${counts[f.id] ?? 0})` : ` (${rows.length})`}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="space-y-2">
          {visible.length === 0 ? (
            <li className="rounded-xl border border-white/10 p-6 text-sm text-zinc-400">Rien dans cette liste.</li>
          ) : (
            visible.map((r) => (
              <li key={r.productId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.productId)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition",
                    selectedId === r.productId ? "border-amber-400/60 bg-white/10" : "border-white/10 bg-white/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium">{r.name}</p>
                    <Badge className={cn("shrink-0 border text-[10px]", STATE_TONE[r.state])}>{STATE_LABEL[r.state]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {formatWhen(r.createdAt)} · {safeHost(r.sourceUrl) ?? "source inconnue"} · {r.listings} annonce(s)
                    {r.live ? " · en ligne" : ""}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          {!selectedId ? (
            <p className="text-sm text-zinc-400">Sélectionnez un import pour le vérifier.</p>
          ) : loadingDetail || !detail ? (
            <p className="text-sm text-zinc-400">{loadingDetail ? "Chargement…" : "Import introuvable."}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{detail.name}</h2>
                  <p className="text-xs text-zinc-400">
                    Importé le {formatWhen(detail.importedAt)} · {detail.live ? "en ligne" : "non publié"}
                  </p>
                </div>
                <Badge className={cn("border", STATE_TONE[detail.state])}>{STATE_LABEL[detail.state]}</Badge>
              </div>

              {detail.images.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto">
                  {detail.images.map((src) => (
                    <div key={src} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-black/30">
                      <Image src={src} alt="" fill className="object-cover" sizes="96px" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-rose-300">Aucune photo.</p>
              )}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-zinc-400">Prix fournisseur</dt>
                  <dd>{formatEur(detail.supplierPriceCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-400">Stock déclaré</dt>
                  <dd>{detail.stock}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-zinc-400">Source</dt>
                  <dd>
                    {detail.sourceUrl ? (
                      <a
                        href={detail.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 text-amber-200 underline"
                      >
                        {safeHost(detail.sourceUrl) ?? "lien"} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "inconnue"
                    )}
                  </dd>
                </div>
              </dl>

              {detail.descriptionExcerpt ? (
                <p className="line-clamp-6 text-sm text-zinc-300">{detail.descriptionExcerpt}</p>
              ) : (
                <p className="text-sm text-rose-300">Description vide.</p>
              )}

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 p-2">
                  <p className="text-zinc-400">1. Revue de l&apos;import</p>
                  <p className="mt-1 font-medium">{STATE_LABEL[detail.state] ?? detail.state}</p>
                </div>
                <div className="rounded-lg border border-white/10 p-2">
                  <p className="text-zinc-400">2. Conformité produit</p>
                  <p className={cn("mt-1 font-medium", detail.readiness.ready || !detail.readiness.applicable ? "text-emerald-300" : "text-rose-300")}>
                    {!detail.readiness.applicable ? "Non concerné" : detail.readiness.ready ? "Complète" : "Bloquante"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 p-2">
                  <p className="text-zinc-400">3. Publication</p>
                  <p className={cn("mt-1 font-medium", detail.live ? "text-emerald-300" : detail.publication.publishable ? "text-sky-200" : "text-zinc-300")}>
                    {detail.live ? "En ligne" : detail.publication.publishable ? "Autorisée" : "Non autorisée"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Conformité (sécurité produit)</p>
                {!detail.readiness.applicable ? (
                  <p className="mt-1 text-sm text-zinc-300">Produit non physique : non concerné.</p>
                ) : detail.readiness.ready ? (
                  <p className="mt-1 text-sm text-emerald-300">Données obligatoires présentes.</p>
                ) : (
                  <ul className="mt-1 list-disc pl-5 text-sm text-rose-300">
                    {detail.readiness.blocking.map((c) => (
                      <li key={c}>{ISSUE_LABEL[c] ?? c}</li>
                    ))}
                  </ul>
                )}
                {detail.readiness.advisory.length > 0 ? (
                  <p className="mt-1 text-xs text-zinc-400">
                    Conseillé : {detail.readiness.advisory.map((c) => ISSUE_LABEL[c] ?? c).join(", ")}
                  </p>
                ) : null}
                {detail.readiness.applicable && !detail.readiness.ready ? (
                  <p className="mt-2 text-xs text-amber-200">
                    Une approbation enregistre la revue mais ne publie pas ce produit tant que ces données manquent
                    (quel que soit le mode du contrôle de publication).
                  </p>
                ) : null}
              </div>

              {!detail.live && detail.state !== "rejected" ? (
                <div className="space-y-3 rounded-xl border border-white/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Compléter les données de sécurité produit
                  </p>
                  <ListingComplianceSection
                    values={compliance}
                    onChange={(key, value) => setCompliance((cur) => ({ ...cur, [key]: value }))}
                    listingKind={detail.listingKind ?? "PHYSICAL"}
                    productId={detail.productId}
                    name={detail.name}
                    mainImageUrl={detail.images[0] ?? null}
                    showBrand
                    idPrefix={`admin-import-${detail.productId}`}
                  />
                  <Button variant="outline" size="sm" onClick={saveCompliance} disabled={pending}>
                    Enregistrer la conformité
                  </Button>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Annonces ({detail.listings.length}) — {liveListings} en ligne, {requestedListings} demande(s) de mise
                  en ligne
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {detail.listings.map((l) => (
                    <li key={l.listingId} className="flex justify-between gap-2 border-b border-white/5 pb-1">
                      <span>{l.resellerName}</span>
                      <span className="text-zinc-400">
                        {formatEur(l.sellingPriceCents)} · {l.isListed ? "en ligne" : "masquée"}
                        {l.listRequested ? " · demande de mise en ligne" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {detail.history.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Décisions précédentes</p>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-400">
                    {detail.history.map((h) => (
                      <li key={h.at}>
                        {formatWhen(h.at)} — {h.decision === "approve" ? "approuvé" : "refusé"} : {h.note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detail.state === "approved" ? (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  {detail.live ? (
                    <p className="text-sm text-zinc-300">Approuvé et en ligne.</p>
                  ) : (
                    <>
                      <label className="block text-xs text-zinc-400" htmlFor="publish-note">
                        Raison de la publication (obligatoire)
                      </label>
                      <textarea
                        id="publish-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        maxLength={1000}
                        className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                      />
                      <Button onClick={publish} disabled={pending || !detail.publication.publishable}>
                        Publier
                      </Button>
                      {!detail.publication.publishable ? (
                        <p className="text-xs text-amber-200">Complétez d&apos;abord les données de sécurité produit.</p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <label className="block text-xs text-zinc-400" htmlFor="review-note">
                    Raison de la décision (obligatoire, conservée dans le journal)
                  </label>
                  <textarea
                    id="review-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                  />
                  {confirmReject ? (
                    <p className="text-sm text-rose-200">
                      Confirmer le refus : le produit repasse en brouillon et {liveListings} annonce(s) en ligne
                      seront retirées. Cliquez à nouveau sur « Refuser ».
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => decide("approve")} disabled={pending}>
                      Approuver l&apos;import
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => decide("reject")}
                      disabled={pending || detail.state === "rejected"}
                      className="border-rose-500/50 text-rose-200"
                    >
                      Refuser
                    </Button>
                  </div>
                  {detail.state === "legacy_unreviewed" ? (
                    <p className="text-xs text-amber-200">
                      Ancien import (avant le 18 novembre) : toute décision ici est la régularisation qui t&apos;est
                      réservée.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
