import { redirect } from "next/navigation"

type Props = { params: Promise<{ id: string }> }

export default async function AdminProviderEditRedirect({ params }: Props) {
  await params
  redirect("/admin/providers")
}
