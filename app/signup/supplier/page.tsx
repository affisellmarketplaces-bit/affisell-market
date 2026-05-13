"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"

import { messageForCredentialsSignInCode } from "@/lib/auth-portal-signin-messages"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SupplierSignupPage() {
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
      body: JSON.stringify({
        email,
        password,
        role: "SUPPLIER",
        name: displayName.trim() || undefined,
      }),
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
      callbackUrl: "/dashboard/supplier",
    })
    setLoading(false)
    if (login?.error) {
      setError(messageForCredentialsSignInCode(login.code) ?? "Account created — try signing in.")
    }
    else router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-sm">
          <Link href="/signup" className="font-medium text-gray-600 hover:text-gray-900">
            ← Back to options
          </Link>
        </p>

        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">📦</div>
          <h1 className="text-3xl font-bold text-gray-900">Get Thousands of Affiliates Selling For You</h1>
          <p className="mt-2 text-gray-600">Affiliates promote your products — you keep the profit</p>
        </div>

        <div className="rounded-2xl border-2 border-green-600/30 bg-white p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="supplier-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                Your name (optional)
              </label>
              <input
                id="supplier-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex — used for your default store name"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label htmlFor="supplier-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="supplier-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label htmlFor="supplier-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="supplier-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-green-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-green-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create supplier account"}
            </button>
            {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="space-y-2.5 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Affiliates sell for you — zero outreach needed
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Zero upfront fees — pay only per sale
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> We handle tracking, payouts & support
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            Want to promote instead?{" "}
            <Link href="/signup/affiliate" className="font-medium text-blue-600 hover:text-blue-700">
              Join as affiliate
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/auth/signin?callbackUrl=%2Fdashboard%2Fsupplier" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
