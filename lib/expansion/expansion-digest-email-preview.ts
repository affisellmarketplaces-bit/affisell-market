import type { ExpansionDigestEmailProps } from "@/emails/expansion-digest"
import {
  buildExpansionDigestConsoleFooterLines,
  buildExpansionDigestConsoleUrl,
  buildExpansionDigestTopMultiAlertCountrySummaries,
  countExpansionDigestMultiAlertCountries,
  resolveExpansionDigestMultiAlertConsoleUrl,
  type ExpansionCountryEmailAlertInput,
} from "@/lib/expansion/expansion-digest-country-alert-signals"

export const EXPANSION_DIGEST_EMAIL_PREVIEW_APP_URL = "https://affisell.com"

export const EXPANSION_DIGEST_EMAIL_PREVIEW_COUNTRIES: ExpansionCountryEmailAlertInput[] = [
  {
    countryIso2: "jp",
    funnel: { notifiedCount: 12 },
    launchComplaintsThisMonth: 1,
    launchBounceRetriesPending: 1,
    launchBounceSuppressed: 0,
    launchDeliveryRatePct: 90,
    launchFollowupSentThisMonth: 8,
    launchFollowupComplaintsThisMonth: 0,
    launchFollowupBouncesThisMonth: 1,
    launchFollowupDeliveryRatePct: 90,
    launchGraduatedSentThisMonth: 0,
    launchGraduatedComplaintsThisMonth: 0,
    launchGraduatedBouncesThisMonth: 0,
    launchGraduatedDeliveryRatePct: 90,
  },
  {
    countryIso2: "kr",
    funnel: { notifiedCount: 12 },
    launchComplaintsThisMonth: 1,
    launchBounceRetriesPending: 0,
    launchBounceSuppressed: 0,
    launchDeliveryRatePct: 55,
    launchFollowupSentThisMonth: 0,
    launchFollowupComplaintsThisMonth: 0,
    launchFollowupBouncesThisMonth: 0,
    launchFollowupDeliveryRatePct: 90,
    launchGraduatedSentThisMonth: 0,
    launchGraduatedComplaintsThisMonth: 0,
    launchGraduatedBouncesThisMonth: 0,
    launchGraduatedDeliveryRatePct: 90,
  },
  {
    countryIso2: "sg",
    funnel: { notifiedCount: 12 },
    launchComplaintsThisMonth: 1,
    launchBounceRetriesPending: 1,
    launchBounceSuppressed: 0,
    launchDeliveryRatePct: 55,
    launchFollowupSentThisMonth: 0,
    launchFollowupComplaintsThisMonth: 0,
    launchFollowupBouncesThisMonth: 0,
    launchFollowupDeliveryRatePct: 90,
    launchGraduatedSentThisMonth: 0,
    launchGraduatedComplaintsThisMonth: 0,
    launchGraduatedBouncesThisMonth: 0,
    launchGraduatedDeliveryRatePct: 90,
  },
  {
    countryIso2: "th",
    funnel: { notifiedCount: 12 },
    launchComplaintsThisMonth: 1,
    launchBounceRetriesPending: 0,
    launchBounceSuppressed: 0,
    launchDeliveryRatePct: 90,
    launchFollowupSentThisMonth: 0,
    launchFollowupComplaintsThisMonth: 0,
    launchFollowupBouncesThisMonth: 0,
    launchFollowupDeliveryRatePct: 90,
    launchGraduatedSentThisMonth: 0,
    launchGraduatedComplaintsThisMonth: 0,
    launchGraduatedBouncesThisMonth: 0,
    launchGraduatedDeliveryRatePct: 90,
  },
]

export function buildExpansionDigestEmailPreviewProps(
  appUrl = EXPANSION_DIGEST_EMAIL_PREVIEW_APP_URL
): ExpansionDigestEmailProps {
  const countries = EXPANSION_DIGEST_EMAIL_PREVIEW_COUNTRIES
  const adminConsoleUrl = buildExpansionDigestConsoleUrl(appUrl, countries)
  const filteredConsoleUrl = resolveExpansionDigestMultiAlertConsoleUrl(appUrl, countries)
  const multiAlertCountryCount = countExpansionDigestMultiAlertCountries(countries)
  const topMultiAlertCountries = buildExpansionDigestTopMultiAlertCountrySummaries(appUrl, countries)
  const footerLines = buildExpansionDigestConsoleFooterLines(appUrl, countries)

  return {
    bodyText: ["Region: ROW", "Graduation emails pending: 2", "", ...footerLines].join("\n"),
    adminConsoleUrl,
    filteredConsoleUrl,
    multiAlertCountryCount,
    topMultiAlertCountries,
    graduationPendingCount: 2,
    graduatedBrowseLinks: [{ label: "Japan", url: `${appUrl}/shops/browse?shipsTo=jp` }],
  }
}
