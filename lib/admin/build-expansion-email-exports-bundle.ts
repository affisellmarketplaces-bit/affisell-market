import JSZip from "jszip"

import { buildExpansionBounceCsv } from "@/lib/admin/build-expansion-bounce-csv"
import { buildExpansionComplaintCsv } from "@/lib/admin/build-expansion-complaint-csv"
import { buildExpansionDeliveredCsv } from "@/lib/admin/build-expansion-delivered-csv"
import { buildExpansionEmailEventsCsv } from "@/lib/admin/build-expansion-email-events-csv"
import { buildSuppressedWaitlistCsv } from "@/lib/admin/build-suppressed-waitlist-csv"
import { EXPANSION_EMAIL_EXPORT_KINDS } from "@/lib/admin/expansion-email-export-kinds"
import { loadExpansionBounceRows } from "@/lib/admin/load-expansion-bounce-rows"
import { loadExpansionComplaintRows } from "@/lib/admin/load-expansion-complaint-rows"
import { loadExpansionDeliveredRows } from "@/lib/admin/load-expansion-delivered-rows"
import { loadExpansionEmailEventRows } from "@/lib/admin/load-expansion-email-event-rows"
import { loadSuppressedWaitlistRows } from "@/lib/admin/load-suppressed-waitlist-rows"
import { SUPPRESSED_WAITLIST_EMAIL_KIND } from "@/lib/admin/load-suppressed-waitlist-rows"

export async function buildExpansionEmailExportsBundle(
  countryIso2?: string,
  now = new Date()
): Promise<Buffer> {
  const zip = new JSZip()

  for (const emailKind of EXPANSION_EMAIL_EXPORT_KINDS) {
    const [bounces, complaints, delivered, events] = await Promise.all([
      loadExpansionBounceRows(countryIso2, emailKind, now),
      loadExpansionComplaintRows(countryIso2, emailKind, now),
      loadExpansionDeliveredRows(countryIso2, emailKind, now),
      loadExpansionEmailEventRows(countryIso2, emailKind, undefined, now),
    ])

    zip.file(`${emailKind}-bounces.csv`, buildExpansionBounceCsv(bounces))
    zip.file(`${emailKind}-complaints.csv`, buildExpansionComplaintCsv(complaints))
    zip.file(`${emailKind}-delivered.csv`, buildExpansionDeliveredCsv(delivered))
    zip.file(`${emailKind}-events.csv`, buildExpansionEmailEventsCsv(events))
  }

  const suppressed = await loadSuppressedWaitlistRows(countryIso2, SUPPRESSED_WAITLIST_EMAIL_KIND)
  zip.file("suppressed-waitlist-checkout-launch.csv", buildSuppressedWaitlistCsv(suppressed))

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })
}
