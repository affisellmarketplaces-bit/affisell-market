"use client"

import Image from "next/image"

/** Client-only QR for invite URLs (no extra dependency). */
export function SupplierInviteQr({ url, size = 160 }: { url: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(url)}`
  return (
    <Image
      src={src}
      alt="QR code invitation fournisseur"
      width={size}
      height={size}
      unoptimized
      className="rounded-xl border border-violet-200/80 bg-white p-1 dark:border-violet-800"
    />
  )
}
