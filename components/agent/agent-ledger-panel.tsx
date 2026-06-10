"use client"

import type { AgentLedgerRow } from "@/lib/agents/load-agent-ledger"

const TYPE_LABEL: Record<string, string> = {
  CREDIT: "Crédit",
  DEBIT: "Débit",
}

type Props = {
  entries: AgentLedgerRow[]
  balanceCents: number
}

export function AgentLedgerPanel({ entries, balanceCents }: Props) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Historique des gains</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Solde disponible {(balanceCents / 100).toFixed(2)} € — crédits idempotents à chaque mission validée.
      </p>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Aucun mouvement pour l&apos;instant.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {TYPE_LABEL[e.type] ?? e.type} +{(e.amountCents / 100).toFixed(2)} €
                </p>
                <p className="truncate text-xs text-zinc-500">{e.note ?? "—"}</p>
              </div>
              <time className="shrink-0 text-xs text-zinc-400">
                {new Date(e.createdAt).toLocaleDateString("fr-FR")}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
