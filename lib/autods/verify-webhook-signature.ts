import { createHmac, timingSafeEqual } from "node:crypto"

export type AutoDsSignatureCheck = "valid" | "invalid" | "skipped"

export function verifyAutoDsWebhookSignature(
  rawBody: string,
  signature: string | null,
  clientIp: string | null
): AutoDsSignatureCheck {
  const secret = process.env.AUTODS_WEBHOOK_SECRET?.trim()
  if (!secret) {
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

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
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
