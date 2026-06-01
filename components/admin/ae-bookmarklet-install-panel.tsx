"use client"

import { useCallback, useState } from "react"
import { Check, Copy, Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  bookmarkletHref: string
  appOrigin: string
}

export function AeBookmarkletInstallPanel({ bookmarkletHref, appOrigin }: Props) {
  const [copied, setCopied] = useState(false)

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletHref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [bookmarkletHref])

  return (
    <div className="space-y-6 rounded-2xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900 dark:bg-zinc-900">
      <div className="rounded-xl bg-violet-950 px-4 py-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">Étape 1</p>
        <p className="mt-2 text-sm">
          Glissez ce bouton dans votre barre de favoris (ou clic droit → « Ajouter aux favoris ») :
        </p>
        <a
          href={bookmarkletHref}
          onClick={() => {
            try {
              localStorage.setItem("affisell.aeImportBookmarklet.v6", "1")
              localStorage.setItem("affisell.aeImportBookmarklet.origin", appOrigin)
            } catch {
              /* ignore */
            }
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-violet-950 hover:bg-violet-50"
          title="Glisser vers la barre de favoris"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Affisell Import AE
        </a>
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Ou copiez l&apos;URL du favori (javascript:…)
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Créez un favori manuellement et collez cette URL dans le champ « Adresse » / « URL ».
        </p>
        <textarea
          readOnly
          className="mt-2 h-28 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[10px] leading-relaxed dark:border-zinc-700 dark:bg-zinc-950"
          value={bookmarkletHref}
          onFocus={(e) => e.target.select()}
        />
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void copyLink()}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copié" : "Copier l'URL du favori"}
        </Button>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
        <li>
          Page produit admin → <strong>Lancer import express</strong> (ouvre AliExpress + pont).
        </li>
        <li>
          Sur la fiche produit AliExpress → cliquez le favori <strong>Affisell Import AE</strong>.
        </li>
        <li>Retour admin → champs remplis → Enregistrer.</li>
      </ol>

      <p className="text-xs text-zinc-500">
        Origine Affisell : <code className="text-[11px]">{appOrigin}</code>
      </p>
    </div>
  )
}
