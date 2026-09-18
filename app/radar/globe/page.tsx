import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { GlobePageClient } from "@/components/radar/GlobePageClient"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("radarGlobe")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: true, follow: true },
  }
}

/**
 * Trust Radar 3D Globe — immersive full-screen (client Three.js).
 * Path: /radar/globe
 */
export default function RadarGlobePage() {
  return <GlobePageClient />
}
