"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function AffiliateSignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role: "AFFILIATE" }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setLoading(false)
      setError(data.error ?? "Signup failed")
      return
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard/affiliate",
    })
    setLoading(false)
    if (login?.error) setError("Account created — try signing in.")
    else router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/signup" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Earn up to 100% Commission</h1>
          <p className="mt-2 text-gray-600">Promote products, earn up to 100% commission and margin</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="affiliate-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                Your name (optional)
              </label>
              <input
                id="affiliate-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex — used for your default store name"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="affiliate-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="affiliate-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="affiliate-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="affiliate-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create affiliate account"}
            </button>
            {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="space-y-2.5 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Keep 100% margin on your own products
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Instant payouts daily to PayPal or Wise
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Zero inventory — we handle everything
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Want to sell instead?{" "}
          <Link href="/signup/supplier" className="font-medium text-green-600 hover:text-green-700">
            Join as supplier
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
