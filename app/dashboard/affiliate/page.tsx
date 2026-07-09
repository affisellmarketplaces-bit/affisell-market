import { AffiliateDashboardHome } from "@/components/dashboard/affiliate-dashboard-home"

export const dynamic = "force-dynamic"

/** No Prisma on SSR — hosted DB may block queries when transfer quota is exceeded. */
export default async function AffiliateDashboardPage() {
  return <AffiliateDashboardHome callbackPath="/dashboard/affiliate" />
}
