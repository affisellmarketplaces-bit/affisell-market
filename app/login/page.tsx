"use client"

import { FormEvent, useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function LoginPage() {
  const search = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const callbackUrl = search.get("callbackUrl") ?? "/dashboard"
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl })
    setLoading(false)
    if (res?.ok && res?.url) {
      window.location.href = res.url
    } else if (res?.ok) {
      window.location.href = callbackUrl || "/dashboard"
    } else {
      setError("Invalid email or password.")
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form onSubmit={onSubmit} className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mt-4 w-full rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-3 w-full rounded-md border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          disabled={loading}
          className="mt-4 w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "…" : "Sign in"}
        </button>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <p className="mt-4 text-sm">
          <Link href="/signup" className="underline">
            Create account
          </Link>
        </p>
      </form>
    </main>
  )
}
