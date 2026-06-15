export type ExpansionEmailEventMeta = {
  countryIso2: string | null
  emailKind: string
  buyerEmailHash: string | null
}

export function formatExpansionEmailEventError(args: {
  countryIso2: string | null
  emailKind: string
  buyerEmailHash?: string | null
}): string {
  const country = args.countryIso2 ?? ""
  const kind = args.emailKind
  if (args.buyerEmailHash) {
    return country ? `${country}:${kind}:${args.buyerEmailHash}` : `${kind}:${args.buyerEmailHash}`
  }
  return country ? `${country}:${kind}` : kind
}

export function parseExpansionEmailEventMeta(error: string | null | undefined): ExpansionEmailEventMeta {
  if (!error) return { countryIso2: null, emailKind: "unknown", buyerEmailHash: null }

  const parts = error.split(":")
  const countryRaw = parts[0]?.trim().toLowerCase()
  const countryIso2 = countryRaw && countryRaw.length === 2 ? countryRaw : null

  if (countryIso2) {
    const emailKind = parts[1]?.trim() || "unknown"
    const buyerEmailHash = parts[2]?.trim() || null
    return { countryIso2, emailKind, buyerEmailHash }
  }

  const emailKind = parts[0]?.trim() || "unknown"
  const buyerEmailHash = parts[1]?.trim() || null
  return { countryIso2: null, emailKind, buyerEmailHash }
}
