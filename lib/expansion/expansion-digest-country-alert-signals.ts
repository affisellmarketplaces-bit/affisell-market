import { expansionEmailExportsBundlePath } from "@/lib/admin/expansion-email-export-kinds"
import {
  buildExpansionAdminMultiAlertConsoleUrl,
  EXPANSION_ADMIN_EXPANSION_CONSOLE_PATH,
} from "@/lib/expansion/expansion-admin-multi-alert-filter"
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
  const bundleHref = buildExpansionDigestMultiAlertCountryBundleUrl(adminUrl, row.countryIso2)
  return (
    `• ${countryLabel} (${row.countryIso2}) — ${signalCount} signal(s): ` +
    `${formatExpansionCountryEmailAlertSignalSummary(signalLabels)}` +
    `${expansionCountryMultiAlertDigestBadge(signalCount)} — ` +
    `${formatExpansionDigestMultiAlertCountryBundleLinkLabel(row.countryIso2)} ${bundleHref} · ` +
    `console ${buildExpansionAdminMultiAlertConsoleUrl(adminUrl)}`
  )
}

export type ExpansionAdminMultiAlertBundleLink = {
  countryIso2: string
  label: string
  href: string
  signalCount: number
  signalSummary: string
}

export const EXPANSION_ADMIN_MULTI_ALERT_BUNDLE_PREVIEW_LIMIT = 3

export function formatExpansionAdminMultiAlertBundleLinkLabel(
  countryIso2: string,
  signalLabels: readonly string[]
): string {
  return `${countryIso2.toUpperCase()} · ${formatExpansionCountryEmailAlertSignalSummary(signalLabels)}`
}

export function formatExpansionAdminTopMultiAlertBundleLabel(
  row: ExpansionCountryEmailAlertInput
): string {
  const signalLabels = listExpansionCountryEmailAlertSignalLabels(row)
  return `${formatExpansionAdminMultiAlertBundleLinkLabel(row.countryIso2, signalLabels)} ZIP`
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
      label: formatExpansionAdminMultiAlertBundleLinkLabel(row.countryIso2, signalLabels),
      href: expansionEmailExportsBundlePath(row.countryIso2),
      signalCount,
      signalSummary: formatExpansionCountryEmailAlertSignalSummary(signalLabels),
    }
  })
}

export function buildExpansionAdminTopMultiAlertBundleLinks(
  countries: readonly ExpansionCountryEmailAlertInput[],
  limit = EXPANSION_ADMIN_MULTI_ALERT_BUNDLE_PREVIEW_LIMIT
): ExpansionAdminMultiAlertBundleLink[] {
  return buildExpansionAdminMultiAlertBundleLinks(countries).slice(0, limit)
}

export function formatExpansionAdminMultiAlertZipBarLabel(options: {
  filtered: boolean
  visibleCount: number
}): string {
  if (options.filtered) {
    return "Multi-alert ZIPs"
  }
  return `Multi-alert ZIPs (top ${options.visibleCount})`
}

export const EXPANSION_ADMIN_MULTI_ALERT_ZIP_PREVIEW_BADGE_LABEL = "Preview"
export const EXPANSION_ADMIN_MULTI_ALERT_ZIP_FILTERED_BADGE_LABEL = "Filtered"

export function shouldShowExpansionAdminMultiAlertZipPreviewBadge(filtered: boolean): boolean {
  return !filtered
}

export function shouldShowExpansionAdminMultiAlertZipFilteredBadge(filtered: boolean): boolean {
  return filtered
}

export function formatExpansionAdminMultiAlertZipBarAccessibleLabel(options: {
  filtered: boolean
  visibleCount: number
}): string {
  const barLabel = formatExpansionAdminMultiAlertZipBarLabel(options)
  if (options.filtered) {
    return `${barLabel} — ${EXPANSION_ADMIN_MULTI_ALERT_ZIP_FILTERED_BADGE_LABEL}`
  }
  return `${barLabel} — ${EXPANSION_ADMIN_MULTI_ALERT_ZIP_PREVIEW_BADGE_LABEL}`
}

export function shouldShowExpansionAdminMultiAlertZipViewAllLink(options: {
  filtered: boolean
  totalCount: number
  visibleCount: number
}): boolean {
  return !options.filtered && options.totalCount > options.visibleCount
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

  const zipExportLines = buildExpansionDigestMultiAlertZipExportLines(adminUrl, countries, 3)

  return [
    "",
    "Multi-signal email alerts by country (month, ≥2 signals):",
    `• Filtered console — ${buildExpansionAdminMultiAlertConsoleUrl(adminUrl)}`,
    ...zipExportLines,
    ...rows.map(({ row }) =>
      buildExpansionCountryMultiAlertDigestLine(adminUrl, row, countryLabel(row.countryIso2))
    ),
  ]
}

export function buildExpansionDigestConsoleUrl(
  adminUrl: string,
  countries: readonly ExpansionCountryEmailAlertInput[]
): string {
  const origin = adminUrl.replace(/\/$/, "")
  if (filterExpansionAdminMultiAlertCountries(countries).length > 0) {
    return buildExpansionAdminMultiAlertConsoleUrl(adminUrl)
  }
  return `${origin}${EXPANSION_ADMIN_EXPANSION_CONSOLE_PATH}`
}

export function formatExpansionDigestConsoleFooterLabel(hasMultiAlertCountries: boolean): string {
  return hasMultiAlertCountries ? "Console (multi-alert filter)" : "Console"
}

export function buildExpansionDigestConsoleFooterLine(
  adminUrl: string,
  countries: readonly ExpansionCountryEmailAlertInput[]
): string {
  const consoleUrl = buildExpansionDigestConsoleUrl(adminUrl, countries)
  const hasMultiAlertCountries = filterExpansionAdminMultiAlertCountries(countries).length > 0
  return `${formatExpansionDigestConsoleFooterLabel(hasMultiAlertCountries)}: ${consoleUrl}`
}

export function formatExpansionDigestMultiAlertZipFooterSegment(
  row: ExpansionDigestMultiAlertCountrySummary
): string {
  return `${formatExpansionDigestMultiAlertCountryBundleLinkLabel(row.countryIso2)} ${row.bundleHref}`
}

export const EXPANSION_DIGEST_MULTI_ALERT_ZIP_FOOTER_LIMIT = 3

export function countExpansionDigestMultiAlertZipFooterHiddenCountries(
  multiAlertCountryCount: number,
  limit = EXPANSION_DIGEST_MULTI_ALERT_ZIP_FOOTER_LIMIT
): number {
  return Math.max(0, multiAlertCountryCount - limit)
}

export function formatExpansionDigestMultiAlertZipFooterMoreSuffix(
  multiAlertCountryCount: number,
  limit = EXPANSION_DIGEST_MULTI_ALERT_ZIP_FOOTER_LIMIT
): string | null {
  const hiddenCount = countExpansionDigestMultiAlertZipFooterHiddenCountries(
    multiAlertCountryCount,
    limit
  )
  if (hiddenCount <= 0) {
    return null
  }
  return ` · +${hiddenCount} more`
}

export function shouldShowExpansionDigestMultiAlertZipFooterMoreLink(
  multiAlertCountryCount: number,
  limit = EXPANSION_DIGEST_MULTI_ALERT_ZIP_FOOTER_LIMIT
): boolean {
  return countExpansionDigestMultiAlertZipFooterHiddenCountries(multiAlertCountryCount, limit) > 0
}

export function buildExpansionDigestMultiAlertZipFooterLine(
  adminUrl: string,
  countries: readonly ExpansionCountryEmailAlertInput[],
  limit = EXPANSION_DIGEST_MULTI_ALERT_ZIP_FOOTER_LIMIT
): string | null {
  const summaries = buildExpansionDigestTopMultiAlertCountrySummaries(adminUrl, countries, limit)
  if (summaries.length === 0) {
    return null
  }
  const parts = summaries.map(formatExpansionDigestMultiAlertZipFooterSegment)
  const moreSuffix = formatExpansionDigestMultiAlertZipFooterMoreSuffix(
    countExpansionDigestMultiAlertCountries(countries),
    limit
  )
  return `Multi-alert ZIPs: ${parts.join(" · ")}${moreSuffix ?? ""}`
}

export function buildExpansionDigestConsoleFooterLines(
  adminUrl: string,
  countries: readonly ExpansionCountryEmailAlertInput[]
): string[] {
  const lines = [buildExpansionDigestConsoleFooterLine(adminUrl, countries)]
  const zipFooterLine = buildExpansionDigestMultiAlertZipFooterLine(adminUrl, countries)
  if (zipFooterLine) {
    lines.push(zipFooterLine)
  }
  return lines
}

export function resolveExpansionDigestMultiAlertConsoleUrl(
  adminUrl: string,
  countries: readonly ExpansionCountryEmailAlertInput[]
): string | null {
  if (filterExpansionAdminMultiAlertCountries(countries).length === 0) {
    return null
  }
  return buildExpansionAdminMultiAlertConsoleUrl(adminUrl)
}

export function countExpansionDigestMultiAlertCountries(
  countries: readonly ExpansionCountryEmailAlertInput[]
): number {
  return filterExpansionAdminMultiAlertCountries(countries).length
}

export function formatExpansionDigestMultiAlertEmailBadgeLabel(countryCount: number): string {
  return `Multi-alert · ${countryCount} ${countryCount === 1 ? "country" : "countries"}`
}

export type ExpansionDigestMultiAlertCountrySummary = {
  countryIso2: string
  signalCount: number
  signalSummary: string
  bundleHref: string
}

export function buildExpansionDigestMultiAlertCountryBundleUrl(
  adminUrl: string,
  countryIso2: string
): string {
  const origin = adminUrl.replace(/\/$/, "")
  return `${origin}${expansionEmailExportsBundlePath(countryIso2)}`
}

export function formatExpansionDigestMultiAlertCountryBundleLinkLabel(
  countryIso2: string
): string {
  return `${countryIso2.toUpperCase()} ZIP`
}

export function buildExpansionDigestTopMultiAlertCountrySummaries(
  adminUrl: string,
  countries: readonly ExpansionCountryEmailAlertInput[],
  limit = 3
): ExpansionDigestMultiAlertCountrySummary[] {
  return filterExpansionAdminMultiAlertCountries(
    sortExpansionAdminCountriesByAlertSignals(countries)
  )
    .slice(0, limit)
    .map((row) => {
      const signalLabels = listExpansionCountryEmailAlertSignalLabels(row)
      return {
        countryIso2: row.countryIso2,
        signalCount: signalLabels.length,
        signalSummary: formatExpansionCountryEmailAlertSignalSummary(signalLabels),
        bundleHref: buildExpansionDigestMultiAlertCountryBundleUrl(adminUrl, row.countryIso2),
      }
    })
}

export function formatExpansionDigestMultiAlertCountryLine(
  row: ExpansionDigestMultiAlertCountrySummary
): string {
  return `${row.countryIso2.toUpperCase()} · ${row.signalCount} signals: ${row.signalSummary}`
}

export function buildExpansionDigestMultiAlertZipExportLines(
  adminUrl: string,
  countries: readonly ExpansionCountryEmailAlertInput[],
  limit = 3
): string[] {
  const summaries = buildExpansionDigestTopMultiAlertCountrySummaries(adminUrl, countries, limit)
  if (summaries.length === 0) {
    return []
  }
  return summaries.map(
    (row) =>
      `• ${formatExpansionDigestMultiAlertCountryBundleLinkLabel(row.countryIso2)} — ${row.bundleHref}`
  )
}
