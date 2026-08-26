"use client"

import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type LegalLetterPrintProps = {
  id: string
  type: string
  supplierName: string
  contentHtml: string
  createdAt: string
}

export function LegalLetterPrintView({
  id,
  type,
  supplierName,
  contentHtml,
  createdAt,
}: LegalLetterPrintProps) {
  const typeLabel =
    type === "mise_en_demeure" ? "Mise en demeure" : "Avertissement préalable"

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="no-print sticky top-0 z-50 border-b border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{typeLabel}</p>
            <p className="text-xs text-zinc-500">
              {supplierName} · {new Date(createdAt).toLocaleString("fr-FR")} · ref {id.slice(0, 8)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/admin/legal"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Retour Avocat
            </Link>
            <button
              type="button"
              className={cn(buttonVariants({ size: "sm" }), "bg-amber-700 hover:bg-amber-600")}
              onClick={() => window.print()}
            >
              Imprimer
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              disabled
              title="Envoi email — bientôt disponible"
            >
              Envoyer par email (bientôt)
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[21cm] bg-white p-0 shadow-lg print:shadow-none dark:bg-white">
        <iframe
          title={`Lettre juridique ${id}`}
          srcDoc={contentHtml}
          className="min-h-[29.7cm] w-full border-0 bg-white"
          sandbox="allow-same-origin"
        />
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  )
}
