import { cookies } from "next/headers"

import { DashboardAutoDraft } from "@/components/dashboard/dashboard-auto-draft"
import { OAuthWelcomeToast } from "@/components/oauth-welcome-toast"
import { RadarUnlockBanner } from "@/components/radar/radar-unlock-banner"
import { OAUTH_WELCOME_COOKIE } from "@/lib/oauth-cookies"

/** Auth + cookies on every merchant route — never static at build time. */
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const welcome = jar.get(OAUTH_WELCOME_COOKIE)?.value

  return (
    <>
      <RadarUnlockBanner />
      <DashboardAutoDraft />
      {welcome ? (
        <div className="px-4 pt-6 md:px-8">
          <div className="mx-auto max-w-6xl">
            <OAuthWelcomeToast provider={welcome} />
          </div>
        </div>
      ) : null}
      {children}
    </>
  )
}
