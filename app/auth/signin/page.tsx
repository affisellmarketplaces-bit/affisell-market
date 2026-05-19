import { redirect } from "next/navigation"

type Props = {
  searchParams: Promise<{ callbackUrl?: string; role?: string }>
}

export default async function LegacySignInPage({ searchParams }: Props) {
  const sp = await searchParams
  const role = sp.role?.trim().toLowerCase()
  const callback = sp.callbackUrl

  if (role === "affiliate") {
    const q = callback ? `?callbackUrl=${encodeURIComponent(callback)}` : ""
    redirect(`/login/affiliate${q}`)
  }
  if (role === "supplier") {
    const q = callback ? `?callbackUrl=${encodeURIComponent(callback)}` : ""
    redirect(`/login/supplier${q}`)
  }

  const q = callback ? `?callbackUrl=${encodeURIComponent(callback)}` : ""
  redirect(`/login${q}`)
}
