import type { PublishInput, PublishResult } from "./types"

export async function publishToTwitter(_input: PublishInput): Promise<PublishResult> {
  return { ok: false, code: "oauth_required", message: "X: OAuth P1" }
}
