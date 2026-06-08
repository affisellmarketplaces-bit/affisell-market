export type TwilioDeliveryConfig = {
  accountSid: string
  authToken: string
  fromNumber: string
  testSmsTo: string | null
}

export function readTwilioDeliveryConfig(): TwilioDeliveryConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim()
  if (!accountSid || !authToken || !fromNumber) return null
  const testSmsTo = process.env.TEST_SMS_TO?.trim() || null
  return { accountSid, authToken, fromNumber, testSmsTo }
}

export function resolveSmsRecipient(intendedTo: string, config: TwilioDeliveryConfig): string {
  const trimmed = intendedTo.trim()
  if (config.testSmsTo) return config.testSmsTo
  return trimmed
}

export function normalizeE164Phone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 8) return null
  if (digits.startsWith("00")) return `+${digits.slice(2)}`
  if (digits.startsWith("0") && digits.length === 10) return `+33${digits.slice(1)}`
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`
  return null
}

export async function sendTwilioSms(args: {
  config: TwilioDeliveryConfig
  to: string
  body: string
  context: string
}): Promise<{ ok: true; sid?: string } | { ok: false; error: string }> {
  const to = resolveSmsRecipient(args.to, args.config)
  const normalized = normalizeE164Phone(to)
  if (!normalized) {
    return { ok: false, error: "invalid_phone" }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${args.config.accountSid}/Messages.json`
  const auth = Buffer.from(`${args.config.accountSid}:${args.config.authToken}`).toString("base64")
  const body = new URLSearchParams({
    To: normalized,
    From: args.config.fromNumber,
    Body: args.body.slice(0, 320),
  })

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    })
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string }
    if (!res.ok) {
      console.error(`[${args.context}]`, {
        result: "sms_failed",
        status: res.status,
        message: json.message ?? "twilio_error",
      })
      return { ok: false, error: json.message ?? `twilio_${res.status}` }
    }
    console.log(`[${args.context}]`, { result: "sms_sent", sid: json.sid })
    return { ok: true, sid: json.sid }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[${args.context}]`, { result: "sms_failed", message })
    return { ok: false, error: message }
  }
}
