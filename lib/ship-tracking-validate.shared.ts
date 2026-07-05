import {
  assertOtherCarrierAllowed,
  resolveShipTrackingPolicy,
  type ShipTrackingPolicy,
} from "@/lib/ship-tracking-policy.shared"
import {
  OTHER_TRUSTED_CARRIER_LABEL,
  afterShipSlugForTrustedCarrier,
} from "@/lib/trusted-carriers-shared"

export type ShipTrackingFormatResult =
  | { ok: true; normalized: string; afterShipSlug?: string }
  | { ok: false; code: string; message: string }

const MIN_LEN = 8
const MAX_LEN = 120

/** Carrier-specific patterns (AfterShip slugs). Fallback is generic alphanumeric. */
const SLUG_PATTERNS: Record<string, RegExp> = {
  colissimo: /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z0-9]{13}$/i,
  chronopost: /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z0-9]{11,15}$/i,
  mondialrelay: /^\d{8}$|^[A-Z0-9]{8,12}$/i,
  ups: /^1Z[0-9A-Z]{16}$/i,
  fedex: /^\d{12}$|^\d{15}$|^\d{20,22}$/,
  usps: /^\d{20,22}$|^[A-Z]{2}\d{9}[A-Z]{2}$/i,
  dhl: /^\d{10,11}$|^\d{3}-\d{8,10}$/,
  "dpd-de": /^\d{14}$|^[0-9%]{14,20}$/,
  dpd: /^\d{14}$|^[0-9%]{14,20}$/,
  gls: /^\d{8,12}$/,
  bpost: /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z0-9]{13,20}$/i,
  postnl: /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z0-9]{13,15}$/i,
  "royal-mail": /^[A-Z]{2}\d{9}GB$|^[A-Z0-9]{10,13}$/i,
  "canada-post": /^[0-9A-Z]{13,16}$/i,
  "inpost-paczkomaty": /^\d{24}$|^[A-Z0-9]{10,24}$/i,
}

const GENERIC_PATTERN = /^[A-Z0-9][A-Z0-9\-]{7,119}$/i

const GARBAGE_SEQUENCES = [
  "0123456789",
  "1234567890",
  "abcdefghij",
  "qwertyui",
  "azertyui",
  "testtest",
  "tracking",
  "suivi123",
]

export function normalizeTrackingNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase()
}

function isGarbageTracking(normalized: string): boolean {
  if (normalized.length < MIN_LEN || normalized.length > MAX_LEN) return true
  if (!/\d/.test(normalized)) return true
  if (/^(.)\1{6,}$/.test(normalized)) return true
  const lower = normalized.toLowerCase()
  if (GARBAGE_SEQUENCES.some((seq) => lower === seq || lower.startsWith(`${seq}`))) return true
  if (/^(test|fake|xxxx|asdf|demo|n\/a|na|null|none|rien|1234|0000)/i.test(normalized)) return true
  return false
}

function patternForSlug(slug: string | undefined): RegExp {
  if (slug && SLUG_PATTERNS[slug]) return SLUG_PATTERNS[slug]!
  return GENERIC_PATTERN
}

export function isOtherTrustedCarrierLabel(carrierLabel: string): boolean {
  return carrierLabel.trim() === OTHER_TRUSTED_CARRIER_LABEL
}

/** Sync format gate — safe for client + server (no network). */
export function validateShipTrackingFormat(args: {
  trackingCarrier: string
  trackingNumber: string
  policy?: ShipTrackingPolicy
}): ShipTrackingFormatResult {
  const carrier = args.trackingCarrier.trim()
  const normalized = normalizeTrackingNumber(args.trackingNumber)

  if (!carrier) {
    return { ok: false, code: "carrier_required", message: "Choisissez un transporteur." }
  }

  const otherGate = assertOtherCarrierAllowed(carrier, args.policy ?? resolveShipTrackingPolicy())
  if (!otherGate.ok) {
    return { ok: false, code: otherGate.code, message: otherGate.message }
  }

  if (isOtherTrustedCarrierLabel(carrier)) {
    if (!normalized) {
      return { ok: false, code: "tracking_required", message: "Saisissez le numéro de suivi réel." }
    }
    if (isGarbageTracking(normalized)) {
      return {
        ok: false,
        code: "tracking_garbage",
        message:
          "Ce numéro ne ressemble pas à un suivi valide. Copiez-collez le numéro exact fourni par le transporteur.",
      }
    }
    return { ok: true, normalized }
  }

  if (!normalized) {
    return { ok: false, code: "tracking_required", message: "Saisissez le numéro de suivi réel." }
  }

  if (isGarbageTracking(normalized)) {
    return {
      ok: false,
      code: "tracking_garbage",
      message:
        "Ce numéro ne ressemble pas à un suivi valide. Copiez-collez le numéro exact fourni par le transporteur.",
    }
  }

  const slug = afterShipSlugForTrustedCarrier(carrier)
  const pattern = patternForSlug(slug)
  if (!pattern.test(normalized)) {
    return {
      ok: false,
      code: "tracking_format",
      message: `Format invalide pour ${carrier}. Vérifiez le numéro sur votre étiquette d'expédition.`,
    }
  }

  return { ok: true, normalized, afterShipSlug: slug }
}
