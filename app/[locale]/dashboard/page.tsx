import { auth } from "@/auth"
import { redirect } from "@/i18n/navigation"

export default async function DashboardRootPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const sess = await auth()
  if (!sess?.user) {
    redirect({ href: "/login", locale })
  }

  const role = sess!.user.role
  if (role === "SUPPLIER" || role === "ADMIN") {
    redirect({ href: "/dashboard/fournisseur", locale })
  }

  redirect({ href: "/dashboard/affiliate", locale })
}
