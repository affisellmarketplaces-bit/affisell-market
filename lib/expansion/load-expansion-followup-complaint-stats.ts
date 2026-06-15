import { loadExpansionComplaintsByCountryAndKind } from "@/lib/expansion/load-expansion-country-complaints-since"

export async function loadExpansionFollowupComplaintsByCountry(
  now = new Date()
): Promise<Map<string, number>> {
  return loadExpansionComplaintsByCountryAndKind("checkout-launch-followup", now)
}
