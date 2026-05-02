import { redirect } from "next/navigation"

type Props = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LoginRedirect(props: Props) {
  const sp = (await props.searchParams) ?? {}
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue
    qs.set(k, Array.isArray(v) ? (v[0] ?? "") : v)
  }
  const suffix = qs.toString()
  redirect(suffix ? `/auth/signin?${suffix}` : "/auth/signin")
}
