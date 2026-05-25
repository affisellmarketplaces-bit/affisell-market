import type { ReactNode } from "react"

/** Shared invite chrome — sub-routes add their own top bar. */
export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <div data-invite-shell className="relative min-h-[100dvh]">
      <style>{`
        body:has([data-invite-shell]) header[class*="border-b"] {
          display: none !important;
        }
        body:has([data-invite-shell]) footer {
          display: none !important;
        }
      `}</style>
      {children}
    </div>
  )
}
