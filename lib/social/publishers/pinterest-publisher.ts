import type { PublishInput, PublishResult } from "./types"

export async function publishToPinterest(_input: PublishInput): Promise<PublishResult> {
  return { ok: false, code: "oauth_required", message: "Pinterest: OAuth P1" }
}
