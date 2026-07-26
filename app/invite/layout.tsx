import type { ReactNode } from "react"

import { InviteChromeHider } from "@/components/invite/invite-chrome-hider"

/** Shared invite chrome — sub-routes add their own top bar. */
export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <div data-invite-shell className="relative min-h-screen min-h-[100dvh]">
      <InviteChromeHider />
      <style>{`
        body.affisell-invite-shell header[class*="border-b"],
        body:has([data-invite-shell]) header[class*="border-b"] {
          display: none !important;
        }
        body.affisell-invite-shell footer,
        body:has([data-invite-shell]) footer {
          display: none !important;
        }
      `}</style>
      {children}
    </div>
  )
}
