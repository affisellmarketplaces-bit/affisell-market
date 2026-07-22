import type { PublishInput, PublishResult } from "./types"

export async function publishToFacebook(_input: PublishInput): Promise<PublishResult> {
  return { ok: false, code: "oauth_required", message: "Facebook: OAuth P1" }
}
