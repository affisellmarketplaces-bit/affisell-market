import { auth } from "@/auth"

import { AffiliateLiveDashboard } from "./live-dashboard"

const MOCK_USER = {
  name: "Affilie Demo",
  email: "affilie.demo@affisell.local",
}

export default async function AffiliateDashboardPage() {
  const session = await auth()
  const user = session?.user ?? MOCK_USER

  return <AffiliateLiveDashboard user={user} />
}
