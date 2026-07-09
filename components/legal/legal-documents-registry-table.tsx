import Link from "next/link"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { CopyHashButton } from "@/components/legal/copy-hash-button"
import {
  PUBLIC_LEGAL_READ_PATHS,
  type PublicLegalDocumentSummary,
} from "@/lib/legal/public-documents-catalog-shared"

type Props = {
  documents: PublicLegalDocumentSummary[]
}

export function LegalDocumentsRegistryTable({ documents }: Props) {
  return (
    <BentoCard className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-4 py-3 font-semibold">Document</th>
              <th className="px-4 py-3 font-semibold">Version</th>
              <th className="px-4 py-3 font-semibold">Date effective</th>
              <th className="px-4 py-3 font-semibold">Hash SHA-256</th>
              <th className="px-4 py-3 font-semibold">Télécharger</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.slug}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
              >
                <td className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                  <div>{doc.name}</div>
                  <div className="mt-0.5 text-xs font-normal text-zinc-500">{doc.slug}</div>
                </td>
                <td className="px-4 py-4 tabular-nums text-zinc-700 dark:text-zinc-300">
                  {doc.version}
                </td>
                <td className="px-4 py-4 tabular-nums text-zinc-700 dark:text-zinc-300">
                  {doc.effectiveDate}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <code
                      className="break-all font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200"
                      title={doc.hash}
                    >
                      {doc.hash}
                    </code>
                    <CopyHashButton value={doc.hash} />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href={PUBLIC_LEGAL_READ_PATHS[doc.slug]}
                      className="text-sm font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                    >
                      Lire
                    </Link>
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                    >
                      JSON
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BentoCard>
  )
}
