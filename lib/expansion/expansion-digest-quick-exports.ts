import type { ExpansionEmailExportKind } from "@/lib/admin/expansion-email-export-kinds"
import {
  expansionBouncesExportPath,
  expansionComplaintsExportPath,
  expansionDeliveredExportPath,
  expansionEmailExportsBundlePath,
} from "@/lib/admin/expansion-email-export-kinds"

export type ExpansionDigestQuickExportCountry = {
  countryIso2: string
  launchEmailsDeliveredThisMonth: number
  launchGraduatedDeliveredThisMonth: number
  launchFollowupDeliveredThisMonth: number
  launchComplaintsThisMonth: number
  launchGraduatedComplaintsThisMonth: number
  launchFollowupComplaintsThisMonth: number
  launchBounceRetriesPending: number
  launchBounceSuppressed: number
  launchGraduatedBouncesThisMonth: number
  launchFollowupBouncesThisMonth: number
}

export function hasExpansionQuickExportActivity(row: ExpansionDigestQuickExportCountry): boolean {
  return (
    row.launchEmailsDeliveredThisMonth > 0 ||
    row.launchGraduatedDeliveredThisMonth > 0 ||
    row.launchFollowupDeliveredThisMonth > 0 ||
    row.launchComplaintsThisMonth > 0 ||
    row.launchGraduatedComplaintsThisMonth > 0 ||
    row.launchFollowupComplaintsThisMonth > 0 ||
    row.launchBounceRetriesPending > 0 ||
    row.launchBounceSuppressed > 0 ||
    row.launchGraduatedBouncesThisMonth > 0 ||
    row.launchFollowupBouncesThisMonth > 0
  )
}

export function pickExpansionBounceExportKind(
  row: ExpansionDigestQuickExportCountry
): ExpansionEmailExportKind {
  if (row.launchGraduatedBouncesThisMonth > 0) return "checkout-graduated"
  if (row.launchFollowupBouncesThisMonth > 0) return "checkout-launch-followup"
  return "checkout-launch"
}

export function pickExpansionComplaintExportKind(
  row: ExpansionDigestQuickExportCountry
): ExpansionEmailExportKind {
  if (row.launchGraduatedComplaintsThisMonth > 0) return "checkout-graduated"
  if (row.launchFollowupComplaintsThisMonth > 0) return "checkout-launch-followup"
  return "checkout-launch"
}

export function pickExpansionDeliveredExportKind(
  row: ExpansionDigestQuickExportCountry
): ExpansionEmailExportKind {
  if (row.launchGraduatedDeliveredThisMonth > 0) return "checkout-graduated"
  if (row.launchFollowupDeliveredThisMonth > 0) return "checkout-launch-followup"
  return "checkout-launch"
}

export function buildExpansionDigestGlobalQuickExportLines(adminUrl: string): string[] {
  return [
    "Metabase quick exports (all kinds):",
    `• Bundle ZIP — ${adminUrl}${expansionEmailExportsBundlePath()}`,
    `• Bounces CSV — ${adminUrl}${expansionBouncesExportPath()}`,
    `• Complaints CSV — ${adminUrl}${expansionComplaintsExportPath()}`,
    `• Delivered CSV — ${adminUrl}${expansionDeliveredExportPath()}`,
  ]
}

export function buildExpansionDigestCountryQuickExportLine(
  adminUrl: string,
  countryLabel: string,
  row: ExpansionDigestQuickExportCountry
): string {
  const countryIso2 = row.countryIso2
  const bounceKind = pickExpansionBounceExportKind(row)
  const complaintKind = pickExpansionComplaintExportKind(row)
  const deliveredKind = pickExpansionDeliveredExportKind(row)

  return (
    `• ${countryLabel} (${countryIso2}) — ` +
    `bundle ${adminUrl}${expansionEmailExportsBundlePath(countryIso2)} · ` +
    `bounces ${adminUrl}${expansionBouncesExportPath(countryIso2, bounceKind)} · ` +
    `complaints ${adminUrl}${expansionComplaintsExportPath(countryIso2, complaintKind)} · ` +
    `delivered ${adminUrl}${expansionDeliveredExportPath(countryIso2, deliveredKind)}`
  )
}

export type ExpansionAdminQuickExportLink = {
  label: string
  href: string
}

export function buildExpansionAdminQuickExportLinks(): ExpansionAdminQuickExportLink[] {
  return [
    { label: "Bundle", href: expansionEmailExportsBundlePath() },
    { label: "Bounces", href: expansionBouncesExportPath() },
    { label: "Complaints", href: expansionComplaintsExportPath() },
    { label: "Delivered", href: expansionDeliveredExportPath() },
  ]
}

export function shouldShowExpansionAdminQuickExports(args: {
  deliveredThisMonth: number
  bouncesThisMonth: number
  complaintsThisMonth: number
}): boolean {
  return (
    args.deliveredThisMonth > 0 || args.bouncesThisMonth > 0 || args.complaintsThisMonth > 0
  )
}
