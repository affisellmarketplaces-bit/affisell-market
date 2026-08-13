import type { ReactNode } from "react"

type Props = {
  children: ReactNode
}

/** Deep-space gradient backdrop for /boutique grid + empty states (server-safe). */
export function ResellerBoutiquePageShell({ children }: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f]">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1a0b3d] via-[#0a0a0f] to-[#0f766e]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 -top-20 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-violet-600/30 to-indigo-600/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -right-40 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-teal-400/20 to-cyan-400/20 blur-3xl"
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-12">{children}</div>
    </div>
  )
}
