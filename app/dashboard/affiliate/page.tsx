import { redirect } from "next/navigation"
import { Suspense } from "react"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { loginAffiliatePath } from "@/lib/login-redirect"

import { AffiliateDashboard } from "./affiliate-dashboard"

export const dynamic = "force-dynamic"

/** No Prisma on SSR — hosted DB may block queries when transfer quota is exceeded. */
export default async function AffiliateDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect(loginAffiliatePath("/dashboard/affiliate"))
  if (session.user.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session.user.role === "CUSTOMER") redirect("/shops")
  if (session.user.role !== "AFFILIATE") redirect(loginAffiliatePath("/dashboard/affiliate"))

  return (
    <Suspense
      fallback={
        <BentoShell>
          <BentoContainer>
            <BentoCard className="py-12 text-center text-sm text-gray-600 dark:text-zinc-300">
              Loading your dashboard…
            </BentoCard>
          </BentoContainer>
        </BentoShell>
      }
    >
      <AffiliateDashboard storeId={session.user.id} />
    </Suspense>
  )
}
