import type { PublishInput, PublishResult } from "./types"

export async function publishToTikTok(_input: PublishInput): Promise<PublishResult> {
  return { ok: false, code: "oauth_required", message: "TikTok: OAuth P1 — use download + copy caption" }
}
