import { auth } from "@/auth"
import { AffisellPulseExperience } from "@/components/pulse/affisell-pulse-experience"
import { loadPulseFeedItems } from "@/lib/pulse-feed-data"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Affisell Pulse",
  description: "Immersive shoppable video feed — discover products in motion.",
}

export default async function DiscoverPage() {
  const session = await auth()
  const items = await loadPulseFeedItems({
    userId: session?.user?.id ?? null,
    limit: 40,
  })

  return (
    <AffisellPulseExperience
      items={items}
      viewerLoggedIn={Boolean(session?.user?.id)}
    />
  )
}
