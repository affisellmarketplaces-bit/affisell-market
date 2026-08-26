import { readCompanyLegal } from "@/lib/legal/company-env"
import { prisma } from "@/lib/prisma"

export type DsaReportInput = {
  id: string
  type: string
  reporterEmail: string
  description: string
  productId?: string | null
  createdAt: Date
}

const DSA_TYPE_LABELS: Record<string, string> = {
  illicite: "Contenu illicite",
  contrefacon: "Contrefaçon",
  dangereux: "Produit dangereux",
  trompeur: "Pratique trompeuse",
  autre: "Autre",
}

export function dsaTypeLabel(type: string): string {
  return DSA_TYPE_LABELS[type] ?? type
}

export function generateDsaAckEmail(report: DsaReportInput): { subject: string; html: string } {
  const company = readCompanyLegal()
  const ref = report.id.slice(0, 8).toUpperCase()
  const typeLabel = dsaTypeLabel(report.type)
  const date = report.createdAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const subject = `Accusé de réception — Signalement DSA ${ref} | ${company.name}`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="font-family: Georgia, serif; color: #111; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 12px; letter-spacing: 0.15em; color: #92400e; font-weight: bold;">AFFISELL MARKET — DSA</p>
  <h1 style="font-size: 18px;">Accusé de réception de signalement</h1>
  <p>Bonjour,</p>
  <p>Nous accusons réception de votre signalement transmis le <strong>${date}</strong>, conformément à l'<strong>article 16 du Règlement (UE) 2022/2065 (DSA)</strong>.</p>
  <table style="width:100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Référence</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">DSA-${ref}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Type</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${typeLabel}</td></tr>
    ${report.productId ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Produit</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${report.productId}</td></tr>` : ""}
  </table>
  <p>Notre équipe juridique examine votre signalement. Vous recevrez une réponse substantielle <strong>sous 24 heures ouvrées</strong>, sauf circonstances exceptionnelles justifiées par le DSA.</p>
  <p style="font-size: 12px; color: #666;">Point de contact DSA : legal@affisell.com · ${company.name} — ${company.address}</p>
  <hr style="border: none; border-top: 1px solid #ccc; margin: 24px 0;" />
  <p style="font-size: 11px; color: #888;">Ce message confirme la prise en compte de votre signalement. Il ne préjuge pas de la décision finale.</p>
</body>
</html>`

  return { subject, html }
}

export type TransparencyLogEntry = {
  period: string
  moderatedL1211: number
  removedContrefacon: number
  dsaReportsReceived: number
  dsaReportsActionTaken: number
  recallsInitiated: number
  productsScanned: number
  highRiskScans: number
  summaryLines: string[]
}

export async function generateTransparencyLog(): Promise<TransparencyLogEntry> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [scans, dsaReports, recalls, dsaActionTaken] = await Promise.all([
    prisma.legalScan.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { issues: true, riskScore: true, status: true, type: true },
    }),
    prisma.dsaReport.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.productRecall.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.dsaReport.count({
      where: { createdAt: { gte: monthStart }, status: "action_taken" },
    }),
  ])

  let moderatedL1211 = 0
  let removedContrefacon = 0
  let highRiskScans = 0

  for (const scan of scans) {
    if (scan.riskScore >= 70) highRiskScans += 1
    const issues = scan.issues as Array<{ code?: string }>
    for (const issue of issues) {
      if (issue.code === "L121-1" && scan.status === "fixed") moderatedL1211 += 1
      if (issue.code === "CONTREFACON" && (scan.status === "fixed" || scan.status === "ignored"))
        removedContrefacon += 1
    }
  }

  const periodLabel = monthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  const summaryLines = [
    `En ${periodLabel}, ${moderatedL1211} contenu(s) modéré(s) pour non-conformité L121-1 (pratiques commerciales trompeuses).`,
    `${removedContrefacon} retrait(s) ou correction(s) liés à des risques de contrefaçon.`,
    `${dsaReports} signalement(s) DSA reçus via le point de contact ; ${dsaActionTaken} mesure(s) prise(s) (art. 16 DSA).`,
    `${recalls} rappel(s) produit GPSR initié(s).`,
    `${scans.length} scan(s) Guardian exécuté(s) ; ${highRiskScans} alerte(s) haut risque (>70/100).`,
  ]

  return {
    period: periodLabel,
    moderatedL1211,
    removedContrefacon,
    dsaReportsReceived: dsaReports,
    dsaReportsActionTaken: dsaActionTaken,
    recallsInitiated: recalls,
    productsScanned: scans.filter((s) => s.type === "product").length,
    highRiskScans,
    summaryLines,
  }
}
