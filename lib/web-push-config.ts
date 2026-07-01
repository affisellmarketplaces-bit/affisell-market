export type WebPushVapidConfig = {
  publicKey: string
  privateKey: string
  subject: string
}

export function readWebPushVapidConfig(): WebPushVapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "mailto:support@affisell.com"

  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject }
}

export function isWebPushConfigured(): boolean {
  return readWebPushVapidConfig() != null
}
