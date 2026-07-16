import { Suspense } from "react"

import RadarConnectClient from "./connect-client"

export default function RadarConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Chargement…
        </div>
      }
    >
      <RadarConnectClient />
    </Suspense>
  )
}
