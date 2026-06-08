import QRCode from "qrcode"

import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { bookingPassPath } from "@/lib/booking/pass-token"

export function buildBookingPassAbsoluteUrl(token: string): string {
  const base = resolveAppUrl().replace(/\/$/, "")
  const path = bookingPassPath(token)
  return `${base}${path}`
}

export async function generateBookingPassQrDataUrl(passUrl: string): Promise<string> {
  return QRCode.toDataURL(passUrl, {
    width: 280,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#22d3ee",
      light: "#050810",
    },
  })
}
