/** Registre des activités de traitement — art. 30 RGPD (export CNIL). */
export type RgpdRegistreRow = {
  finalite: string
  baseLegale: string
  donnees: string
  duree: string
  destinataires: string
  transfertHorsUe: string
}

export const RGPD_REGISTRE_COLUMNS = [
  "Finalité",
  "Base légale",
  "Données",
  "Durée",
  "Destinataires",
  "Transfert hors UE",
] as const

export const RGPD_REGISTRE_ROWS: RgpdRegistreRow[] = [
  {
    finalite: "Inscription",
    baseLegale: "Contrat",
    donnees: "email, ip",
    duree: "3 ans",
    destinataires: "Stripe, Vercel",
    transfertHorsUe: "USA clauses types",
  },
  {
    finalite: "Paiement",
    baseLegale: "Contrat",
    donnees: "CB via Stripe",
    duree: "5 ans comptable",
    destinataires: "Stripe IE",
    transfertHorsUe: "Non",
  },
  {
    finalite: "Marketing",
    baseLegale: "Consentement",
    donnees: "email",
    duree: "jusqu'opt-out",
    destinataires: "Resend US",
    transfertHorsUe: "USA clauses types",
  },
]

function escapeCsvCell(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** CSV UTF-8 avec BOM — compatible Excel / dépôt CNIL. */
export function buildRgpdRegistreCsv(rows: RgpdRegistreRow[] = RGPD_REGISTRE_ROWS): string {
  const headerLine = RGPD_REGISTRE_COLUMNS.map(escapeCsvCell).join(";")
  const dataLines = rows.map((row) =>
    [
      row.finalite,
      row.baseLegale,
      row.donnees,
      row.duree,
      row.destinataires,
      row.transfertHorsUe,
    ]
      .map(escapeCsvCell)
      .join(";")
  )
  return `\uFEFF${[headerLine, ...dataLines].join("\r\n")}\r\n`
}

export const RGPD_REGISTRE_FILENAME = "affisell-registre-traitements-rgpd.csv"
