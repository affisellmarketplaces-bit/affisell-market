"use client"

import dynamic from "next/dynamic"

const PhotoStudioClient = dynamic(() => import("./PhotoStudioClient"), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
      <p className="text-sm">Loading Photo Studio…</p>
    </main>
  ),
})

export default function PhotoStudioPage() {
  return <PhotoStudioClient />
}
