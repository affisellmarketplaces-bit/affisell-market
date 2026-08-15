import { extractStoreInitials } from "@/lib/storefront-brand-field-generate-shared"

export function buildInitialsLogoSvg(args: {
  storeName: string
  primary: string
  accent: string
}): Buffer {
  const initials = extractStoreInitials(args.storeName)
  const primary = args.primary.trim() || "#5b21b6"
  const accent = args.accent.trim() || "#06b6d4"

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="168" fill="rgba(255,255,255,0.08)" filter="url(#glow)"/>
  <text x="256" y="286" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="168" font-weight="700" letter-spacing="-0.04em">${initials}</text>
</svg>`

  return Buffer.from(svg, "utf-8")
}
