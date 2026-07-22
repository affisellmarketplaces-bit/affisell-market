import type { PublishInput, PublishResult } from "./types"

export async function publishToInstagram(_input: PublishInput): Promise<PublishResult> {
  return { ok: false, code: "oauth_required", message: "Instagram: OAuth P1 — use download + copy caption" }
}
