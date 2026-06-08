import { isValidDigitalAccessUrl } from "@/lib/digital-delivery/resolve-access-url"
import { isDigitalListingKind } from "@/lib/digital-delivery/types"

export type DigitalDeliveryParseResult =
  | { ok: true; data: { digitalAccessUrl: string | null; digitalAccessInstructions: string | null; digitalInstantDelivery: boolean } }
  | { ok: false; error: string }

export function parseProductDigitalDeliveryBody(body: Record<string, unknown>): DigitalDeliveryParseResult {
  const instantRaw = body.digitalInstantDelivery
  const digitalInstantDelivery =
    instantRaw === undefined || instantRaw === null
      ? true
      : instantRaw === true || instantRaw === "true" || instantRaw === 1 || instantRaw === "1"

  const urlRaw = body.digitalAccessUrl
  const digitalAccessUrl =
    typeof urlRaw === "string" && urlRaw.trim().length > 0 ? urlRaw.trim().slice(0, 2000) : null

  const instrRaw = body.digitalAccessInstructions
  const digitalAccessInstructions =
    typeof instrRaw === "string" && instrRaw.trim().length > 0
      ? instrRaw.trim().slice(0, 4000)
      : null

  return {
    ok: true,
    data: { digitalAccessUrl, digitalAccessInstructions, digitalInstantDelivery },
  }
}

export function validateDigitalDeliveryForPublish(
  listingKind: string,
  digital: { digitalAccessUrl: string | null; digitalInstantDelivery: boolean },
  saveAsDraft: boolean
): string | null {
  if (saveAsDraft || !isDigitalListingKind(listingKind)) return null
  if (!digital.digitalInstantDelivery) return null
  if (!digital.digitalAccessUrl?.trim()) {
    return "digital_access_url_required"
  }
  if (!isValidDigitalAccessUrl(digital.digitalAccessUrl)) {
    return "digital_access_url_invalid"
  }
  return null
}

export function digitalDeliveryPublishErrorMessage(code: string): string {
  if (code === "digital_access_url_required") {
    return "URL d'accès digital requise pour publier une formation ou un logiciel."
  }
  if (code === "digital_access_url_invalid") {
    return "URL d'accès invalide (https:// requis, ou placeholders {{orderId}} / {{token}})."
  }
  return code
}
