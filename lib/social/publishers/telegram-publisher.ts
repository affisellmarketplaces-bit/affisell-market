import type { PublishInput, PublishResult } from "./types"

export async function publishToTelegram(_input: PublishInput): Promise<PublishResult> {
  return { ok: false, code: "oauth_required", message: "Telegram: bot token P1" }
}
