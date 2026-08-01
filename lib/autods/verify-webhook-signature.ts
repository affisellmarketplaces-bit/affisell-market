import { createHmac, timingSafeEqual } from "node:crypto"

import { webhookSecretGate } from "@/lib/require-production-secret"

export type AutoDsSignatureCheck = "valid" | "invalid" | "skipped" | "missing_prod"

export function verifyAutoDsWebhookSignature(
  rawBody: string,
  signature: string | null,
  clientIp: string | null
): AutoDsSignatureCheck {
  const secret = process.env.AUTODS_WEBHOOK_SECRET?.trim()
  const gate = webhookSecretGate(secret)
  if (gate === "missing_prod") {
    console.error("[autods-webhook]", {
      result: "missing_prod_secret",
      ip: clientIp ?? "unknown",
    })
    return "missing_prod"
  }
  if (gate === "missing_sig") {
    console.log("[autods-webhook]", {
      result: "signature_skipped_no_secret",
      ip: clientIp ?? "unknown",
    })
    return "skipped"
  }

  if (!signature?.trim()) {
    console.warn("[autods-webhook]", {
      result: "signature_missing",
      ip: clientIp ?? "unknown",
    })
    return "invalid"
  }

  const expected = createHmac("sha256", secret!).update(rawBody).digest("hex")
  const provided = signature.trim().replace(/^sha256=/i, "")

  try {
    const ok = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"))
    if (!ok) {
      console.warn("[autods-webhook]", {
        result: "signature_invalid",
        ip: clientIp ?? "unknown",
      })
    }
    return ok ? "valid" : "invalid"
  } catch {
    console.warn("[autods-webhook]", {
      result: "signature_malformed",
      ip: clientIp ?? "unknown",
    })
    return "invalid"
  }
}
