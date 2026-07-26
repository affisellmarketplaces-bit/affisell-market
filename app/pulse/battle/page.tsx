import type { Metadata } from "next"

import { BattleArena } from "@/components/pulse/BattleArena"

export const metadata: Metadata = {
  title: "Pulse Battle LIVE · Affisell",
  description:
    "Vote en live à 18h — le winner prend −20% pendant 5 minutes. QVC × Twitch.",
}

/**
 * Pulse Live Battle — full-screen vote duel.
 * Path: /pulse/battle
 * BattleArena is a Client Component (no `dynamic({ ssr:false })` in this Server page).
 */
export default function PulseBattlePage() {
  return <BattleArena />
}
