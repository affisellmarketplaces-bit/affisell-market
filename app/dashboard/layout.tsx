import { cookies } from "next/headers"

import { OAuthWelcomeToast } from "@/components/oauth-welcome-toast"
import { OAUTH_WELCOME_COOKIE } from "@/lib/oauth-cookies"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const welcome = jar.get(OAUTH_WELCOME_COOKIE)?.value

  return (
    <>
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
