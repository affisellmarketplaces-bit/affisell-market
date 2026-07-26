import type { Metadata } from "next"
import dynamic from "next/dynamic"

export const metadata: Metadata = {
  title: "Pulse Battle LIVE · Affisell",
  description:
    "Vote en live à 18h — le winner prend −20% pendant 5 minutes. QVC × Twitch.",
}

const BattleArena = dynamic(
  () =>
    import("@/components/pulse/BattleArena").then((m) => ({
      default: m.BattleArena,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black text-sm text-white/50">
        Chargement du battle…
      </div>
    ),
  }
)

/**
 * Pulse Live Battle — full-screen vote duel.
 * Path: /pulse/battle
 */
export default function PulseBattlePage() {
  return <BattleArena />
}
