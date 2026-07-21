import type { Metadata } from "next"

import { BrandHubClient } from "@/components/brand/brand-hub-client"
import { BRAND } from "@/lib/brand/social-profiles"

export const metadata: Metadata = {
  title: "Affisell Brand Hub — Assets & Social Profiles",
  description:
    "Brand kit Affisell: logos, bios multi-réseaux, World Radar screenshots. 18 profils sociaux prêts à connecter.",
  openGraph: {
    title: "Affisell Brand Hub",
    description: BRAND.taglineGlobal,
    url: BRAND.links.brand,
  },
}

export default function BrandPage() {
  return <BrandHubClient />
}
