import { auth } from "@/auth"

import { FournisseurLiveDashboard } from "./live-dashboard"

const MOCK_USER = {
  name: "Fournisseur Demo",
  email: "fournisseur.demo@affisell.local",
}

export default async function FournisseurDashboardPage() {
  const session = await auth()
  const user = session?.user ?? MOCK_USER

  return <FournisseurLiveDashboard user={user} />
}
