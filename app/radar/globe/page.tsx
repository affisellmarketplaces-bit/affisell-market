import type { Metadata } from "next"

import { GlobePageClient } from "@/components/radar/GlobePageClient"

export const metadata: Metadata = {
  title: "Radar Globe LIVE · Affisell",
  description:
    "Globe 3D live — vois les winners qui explosent en temps réel avant tout le monde.",
  robots: { index: true, follow: true },
}

/**
 * Trust Radar 3D Globe — immersive full-screen (client Three.js).
 * Path: /radar/globe
 */
export default function RadarGlobePage() {
  return <GlobePageClient />
}
