import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import { shouldShowFollowupBounceAlertDigestRow } from "@/lib/expansion/expansion-digest-followup-bounce-badge"
import { shouldShowFollowupComplaintAlertDigestRow } from "@/lib/expansion/expansion-digest-followup-complaint-badge"
import { shouldShowFollowupDeliveryAlertDigestRow } from "@/lib/expansion/expansion-digest-followup-delivery-badge"
import { shouldShowGraduationBounceAlertDigestRow } from "@/lib/expansion/expansion-digest-graduation-bounce-badge"
import { shouldShowGraduationComplaintDigestRow } from "@/lib/expansion/expansion-digest-graduation-complaint-badge"
import { shouldShowGraduationDeliveryAlertDigestRow } from "@/lib/expansion/expansion-digest-graduation-delivery-badge"
import { shouldShowLaunchBounceAlertDigestRow } from "@/lib/expansion/expansion-digest-launch-bounce-badge"
import { shouldShowLaunchComplaintAlertDigestRow } from "@/lib/expansion/expansion-digest-launch-complaint-badge"
import { shouldShowLaunchDeliveryAlertDigestRow } from "@/lib/expansion/expansion-digest-launch-delivery-badge"

export const EXPANSION_MULTI_ALERT_MIN_SIGNALS = 2

export type ExpansionCountryEmailAlertInput = {
  countryIso2: string
  funnel: { notifiedCount: number }
  launchComplaintsThisMonth: number
  launchBounceRetriesPending: number
  launchBounceSuppressed: number
  launchDeliveryRatePct: number
  launchFollowupSentThisMonth: number
  launchFollowupComplaintsThisMonth: number
  launchFollowupBouncesThisMonth: number
  launchFollowupDeliveryRatePct: number
  launchGraduatedSentThisMonth: number
  launchGraduatedComplaintsThisMonth: number
  launchGraduatedBouncesThisMonth: number
  launchGraduatedDeliveryRatePct: number
}

export function listExpansionCountryEmailAlertSignalLabels(
  row: ExpansionCountryEmailAlertInput
): string[] {
  const labels: string[] = []

  if (
    shouldShowLaunchComplaintAlertDigestRow({
      notifiedCount: row.funnel.notifiedCount,
      launchComplaintsThisMonth: row.launchComplaintsThisMonth,
    })
  ) {
    labels.push("launch complaint")
  }
  if (
    shouldShowLaunchBounceAlertDigestRow({
      notifiedCount: row.funnel.notifiedCount,
      retriesPending: row.launchBounceRetriesPending,
      suppressed: row.launchBounceSuppressed,
    })
  ) {
    labels.push("launch bounce")
  }
  if (
    shouldShowLaunchDeliveryAlertDigestRow({
      notifiedCount: row.funnel.notifiedCount,
      launchDeliveryRatePct: row.launchDeliveryRatePct,
    })
  ) {
    labels.push("launch delivery")
  }
  if (
    shouldShowFollowupComplaintAlertDigestRow({
      launchFollowupSentThisMonth: row.launchFollowupSentThisMonth,
      launchFollowupComplaintsThisMonth: row.launchFollowupComplaintsThisMonth,
    })
  ) {
    labels.push("J+2 complaint")
  }
  if (
    shouldShowFollowupBounceAlertDigestRow({
      launchFollowupSentThisMonth: row.launchFollowupSentThisMonth,
      launchFollowupBouncesThisMonth: row.launchFollowupBouncesThisMonth,
    })
  ) {
    labels.push("J+2 bounce")
  }
  if (
    shouldShowFollowupDeliveryAlertDigestRow({
      launchFollowupSentThisMonth: row.launchFollowupSentThisMonth,
      launchFollowupDeliveryRatePct: row.launchFollowupDeliveryRatePct,
    })
  ) {
    labels.push("J+2 delivery")
  }
  if (
    shouldShowGraduationComplaintDigestRow({
      launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
      launchGraduatedComplaintsThisMonth: row.launchGraduatedComplaintsThisMonth,
    })
  ) {
    labels.push("graduation complaint")
  }
  if (
    shouldShowGraduationBounceAlertDigestRow({
      launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
      launchGraduatedBouncesThisMonth: row.launchGraduatedBouncesThisMonth,
    })
  ) {
    labels.push("graduation bounce")
  }
  if (
    shouldShowGraduationDeliveryAlertDigestRow({
      launchGraduatedSentThisMonth: row.launchGraduatedSentThisMonth,
      launchGraduatedDeliveryRatePct: row.launchGraduatedDeliveryRatePct,
    })
  ) {
    labels.push("graduation delivery")
  }

  return labels
}

export function countExpansionCountryEmailAlertSignals(row: ExpansionCountryEmailAlertInput): number {
  return listExpansionCountryEmailAlertSignalLabels(row).length
}

export function shouldShowExpansionCountryMultiAlertDigestRow(row: ExpansionCountryEmailAlertInput): boolean {
  return countExpansionCountryEmailAlertSignals(row) >= EXPANSION_MULTI_ALERT_MIN_SIGNALS
}

export function expansionCountryMultiAlertDigestBadge(signalCount: number): string {
  return ` · 🔶 ${signalCount} signals`
}

export function formatExpansionAdminMultiAlertBadgeLabel(signalCount: number): string {
  return `${signalCount} email alerts`
}

export function formatExpansionCountryEmailAlertSignalSummary(
  signalLabels: readonly string[]
): string {
  return signalLabels.join(", ")
}

export function formatExpansionAdminMultiAlertAccessibleLabel(
  signalLabels: readonly string[]
): string {
  return `Multi-alert signals: ${formatExpansionCountryEmailAlertSignalSummary(signalLabels)}`
}

export function buildExpansionCountryMultiAlertDigestLine(
  adminUrl: string,
  row: ExpansionCountryEmailAlertInput,
  countryLabel: string
): string {
  const signalLabels = listExpansionCountryEmailAlertSignalLabels(row)
  const signalCount = signalLabels.length
  return (
    `• ${countryLabel} (${row.countryIso2}) — ${signalCount} signal(s): ` +
    `${formatExpansionCountryEmailAlertSignalSummary(signalLabels)}` +
    `${expansionCountryMultiAlertDigestBadge(signalCount)} — ` +
    `${adminUrl}${expansionEmailExportsBundlePath(row.countryIso2)}`
  )
}

export type ExpansionAdminMultiAlertBundleLink = {
  countryIso2: string
  label: string
  href: string
  signalCount: number
  signalSummary: string
}

export function formatExpansionAdminTopMultiAlertBundleLabel(
  row: ExpansionCountryEmailAlertInput
): string {
  const signalCount = countExpansionCountryEmailAlertSignals(row)
  return `${row.countryIso2.toUpperCase()} · ${signalCount} signals ZIP`
}

export function buildExpansionAdminMultiAlertBundleLinks(
  countries: readonly ExpansionCountryEmailAlertInput[]
): ExpansionAdminMultiAlertBundleLink[] {
  return filterExpansionAdminMultiAlertCountries(
    sortExpansionAdminCountriesByAlertSignals(countries)
  ).map((row) => {
    const signalLabels = listExpansionCountryEmailAlertSignalLabels(row)
    const signalCount = signalLabels.length
    return {
      countryIso2: row.countryIso2,
      label: `${row.countryIso2.toUpperCase()} · ${signalCount}`,
      href: expansionEmailExportsBundlePath(row.countryIso2),
      signalCount,
      signalSummary: formatExpansionCountryEmailAlertSignalSummary(signalLabels),
    }
  })
}

export function sortExpansionAdminCountriesByAlertSignals<T extends ExpansionCountryEmailAlertInput>(
  countries: readonly T[]
): T[] {
  return [...countries].sort((a, b) => {
    const signalDiff =
      countExpansionCountryEmailAlertSignals(b) - countExpansionCountryEmailAlertSignals(a)
    if (signalDiff !== 0) return signalDiff
    return a.countryIso2.localeCompare(b.countryIso2)
  })
}

export function filterExpansionAdminMultiAlertCountries<T extends ExpansionCountryEmailAlertInput>(
  countries: readonly T[]
): T[] {
  return countries.filter((row) => shouldShowExpansionCountryMultiAlertDigestRow(row))
}

export function buildExpansionDigestMultiAlertRecapLines(
  adminUrl: string,
  countries: ExpansionCountryEmailAlertInput[],
  countryLabel: (countryIso2: string) => string
): string[] {
  const rows = countries
    .map((row) => ({
      row,
      signalCount: countExpansionCountryEmailAlertSignals(row),
      signalLabels: listExpansionCountryEmailAlertSignalLabels(row),
    }))
    .filter(({ signalCount }) => signalCount >= EXPANSION_MULTI_ALERT_MIN_SIGNALS)
    .sort((a, b) => b.signalCount - a.signalCount)
    .slice(0, 8)

  if (rows.length === 0) {
    return ["", "Multi-signal email alerts by country (month, ≥2 signals):", "• none"]
  }

  return [
    "",
    "Multi-signal email alerts by country (month, ≥2 signals):",
    ...rows.map(({ row }) =>
      buildExpansionCountryMultiAlertDigestLine(adminUrl, row, countryLabel(row.countryIso2))
    ),
  ]
}
