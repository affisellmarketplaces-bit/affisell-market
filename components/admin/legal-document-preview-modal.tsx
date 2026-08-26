"use client"

import { useState } from "react"
import {
  CheckCircle2,
  Loader2,
  PenLine,
  Printer,
  Send,
  ShieldCheck,
  X,
} from "lucide-react"

import { LegalPreviewFrame, printLegalHtml } from "@/components/admin/legal-preview-frame"
import {
  LEGAL_COCKPIT_ACCENT_TEXT_SOFT,
  LEGAL_COCKPIT_CALLOUT,
  LEGAL_COCKPIT_CTA_SOLID,
  LEGAL_COCKPIT_EYEBROW,
  LEGAL_COCKPIT_ICON,
  LEGAL_COCKPIT_MODAL_HEADER,
  LEGAL_COCKPIT_MODAL_SHELL,
  LEGAL_COCKPIT_TEXT_MUTED,
  LEGAL_COCKPIT_TEXT_PRIMARY,
  legalDocStatusBadge,
  legalOutlineButtonClass,
} from "@/components/admin/legal-cockpit-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type LegalDocumentPreviewData = {
  id: string
  type: string
  title: string
  version: number
  status: string
  markdown: string
  html: string
}

type Props = {
  document: LegalDocumentPreviewData | null
  onClose: () => void
  signEmail: string
  onSignEmailChange: (value: string) => void
  signerName?: string
  onPublish?: () => Promise<void>
  onRequestSign?: () => Promise<void>
  publishing?: boolean
  signing?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  cgv: "CGV Marketplace",
  cgu: "CGU Utilisateurs",
  mentions: "Mentions légales",
  contrat_fournisseur: "Contrat fournisseur",
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

export function LegalDocumentPreviewModal({
  document: doc,
  onClose,
  signEmail,
  onSignEmailChange,
  signerName,
  onPublish,
  onRequestSign,
  publishing = false,
  signing = false,
}: Props) {
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmSign, setConfirmSign] = useState(false)

  if (!doc) return null

  const isDraft = doc.status === "draft"
  const isContrat = doc.type === "contrat_fournisseur"
  const canPublish = isDraft && Boolean(onPublish)
  const canSign = isContrat && doc.status === "published" && Boolean(onRequestSign)

  async function handlePublish() {
    if (!confirmPublish) {
      setConfirmPublish(true)
      return
    }
    await onPublish?.()
    setConfirmPublish(false)
  }

  async function handleSign() {
    if (!signEmail.trim()) return
    if (!confirmSign) {
      setConfirmSign(true)
      return
    }
    await onRequestSign?.()
    setConfirmSign(false)
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-stretch justify-center bg-black/80 p-0 backdrop-blur-md sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-doc-preview-title"
    >
      <div className={cn("flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[92vh]", LEGAL_COCKPIT_MODAL_SHELL)}>
        {/* Header */}
        <div className={cn("flex shrink-0 flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6", LEGAL_COCKPIT_MODAL_HEADER)}>
          <div className="min-w-0 flex-1">
            <p className={LEGAL_COCKPIT_EYEBROW}>
              Prévisualisation · {typeLabel(doc.type)}
            </p>
            <h2 id="legal-doc-preview-title" className={cn("mt-1 truncate text-lg font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>
              {doc.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 font-mono text-[11px] text-zinc-300">
                v{doc.version}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  legalDocStatusBadge(doc.status)
                )}
              >
                {doc.status}
              </span>
              <span className={cn("text-[11px]", LEGAL_COCKPIT_TEXT_MUTED)}>ID {doc.id.slice(0, 10)}…</span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
            onClick={onClose}
            aria-label="Fermer la prévisualisation"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className={cn("mb-4", LEGAL_COCKPIT_CALLOUT)}>
            <ShieldCheck className={cn("mt-0.5 size-4 shrink-0", LEGAL_COCKPIT_ICON)} aria-hidden />
            <p className={cn("text-xs leading-relaxed", LEGAL_COCKPIT_ACCENT_TEXT_SOFT)}>
              Vérifiez le rendu final (mise en page A4, clauses, identité société) avant publication ou envoi au
              signataire. Aucune action externe n&apos;est déclenchée tant que vous ne confirmez pas ci-dessous.
            </p>
          </div>

          <LegalPreviewFrame
            title={doc.title}
            markdown={doc.markdown}
            html={doc.html}
            frameMinHeight="min-h-[min(58vh,640px)]"
          />
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            {canSign ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className={cn("block text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
                  Email signataire
                  <input
                    type="email"
                    className="mt-1 block w-full min-w-[240px] rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    placeholder="fournisseur@example.com"
                    value={signEmail}
                    onChange={(e) => {
                      setConfirmSign(false)
                      onSignEmailChange(e.target.value)
                    }}
                  />
                </label>
                {signerName ? (
                  <p className={cn("text-[11px]", LEGAL_COCKPIT_TEXT_MUTED)}>Signataire : {signerName}</p>
                ) : null}
              </div>
            ) : (
              <p className={cn("text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
                {isDraft
                  ? "Étape suivante : publier pour activer la version sur la plateforme."
                  : "Document prêt — imprimez ou envoyez en signature si applicable."}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), legalOutlineButtonClass())}
                onClick={onClose}
              >
                Fermer
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), legalOutlineButtonClass())}
                onClick={() => printLegalHtml(doc.html, doc.title)}
              >
                <Printer className="mr-1.5 size-4" aria-hidden />
                Imprimer / PDF
              </button>

              {canPublish ? (
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    confirmPublish
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : LEGAL_COCKPIT_CTA_SOLID
                  )}
                  disabled={publishing}
                  onClick={() => void handlePublish()}
                >
                  {publishing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : confirmPublish ? (
                    <>
                      <CheckCircle2 className="mr-1.5 size-4" aria-hidden />
                      Confirmer publication
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1.5 size-4" aria-hidden />
                      Publier
                    </>
                  )}
                </button>
              ) : null}

              {canSign ? (
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    confirmSign ? "bg-emerald-600 hover:bg-emerald-500" : "bg-violet-600 hover:bg-violet-500"
                  )}
                  disabled={signing || !signEmail.trim()}
                  onClick={() => void handleSign()}
                >
                  {signing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : confirmSign ? (
                    <>
                      <Send className="mr-1.5 size-4" aria-hidden />
                      Confirmer envoi signature
                    </>
                  ) : (
                    <>
                      <PenLine className="mr-1.5 size-4" aria-hidden />
                      Envoyer signature
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>

          {confirmPublish ? (
            <p className="mt-2 text-[11px] text-emerald-300/90">
              Les autres versions publiées du même type seront archivées. Cliquez à nouveau pour confirmer.
            </p>
          ) : null}
          {confirmSign ? (
            <p className="mt-2 text-[11px] text-violet-200/90">
              Un lien de signature sera envoyé à {signEmail.trim()}. Cliquez à nouveau pour confirmer.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
