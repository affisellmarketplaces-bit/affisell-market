export type PublishInput = {
  imageUrl: string
  caption: string
  productUrl: string
}

export type PublishResult =
  | { ok: true; externalId?: string }
  | { ok: false; code: "oauth_required" | "error"; message: string }
