import { permanentRedirect } from "next/navigation"

export default async function IntelliDashboardPage() {
  permanentRedirect("/radar")
}
