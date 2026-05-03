"use client"

import type { FormEvent } from "react"
import { Apple, X as XLogo } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import Image from "next/image"
import { useState, Suspense } from "react"

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  )
}

function SignInContent() {
  const search = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [busyProvider, setBusyProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const oauthError = search.get("error")
  const resolvedError =
    error ??
    (oauthError && oauthError !== "OAuthSignin"
      ? "Something went wrong with social sign-in. Try again."
      : null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const callbackUrl = search.get("callbackUrl") ?? "/dashboard"
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl })
    setLoading(false)
    if (res?.ok && res?.url) {
      router.push(res.url)
    } else if (res?.ok) {
      router.push(callbackUrl || "/dashboard")
    } else {
      setError("Invalid email or password.")
    }
  }

  async function oauth(provider: string) {
    setBusyProvider(provider)
    setError(null)
    const raw = search.get("callbackUrl") ?? "/dashboard"
    const callbackUrl = raw.startsWith("/") ? raw : "/dashboard"
    await signIn(provider, { callbackUrl })
    setBusyProvider(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Affisell</h1>
          <p className="mt-2 text-gray-600 dark:text-zinc-400">Sign in to your account</p>
        </div>

        {resolvedError ? (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {resolvedError}
          </p>
        ) : null}

        <div className="space-y-3">
          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => void oauth("google")}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Image src="/google.svg" alt="" width={20} height={20} /> Continue with Google
          </button>

          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => void oauth("facebook")}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] py-3 text-sm font-medium text-white hover:bg-[#166fe5] disabled:opacity-60"
          >
            <FacebookLogo className="h-5 w-5" /> Continue with Facebook
          </button>

          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => void oauth("apple")}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-black py-3 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-60"
          >
            <Apple className="h-5 w-5" /> Continue with Apple
          </button>

          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => void oauth("twitter")}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <XLogo className="h-5 w-5" /> Continue with X
          </button>

          {busyProvider ? (
            <p className="text-center text-xs text-gray-500">Redirecting…</p>
          ) : null}
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide">
            <span className="bg-white px-2 text-gray-500 dark:bg-zinc-900 dark:text-zinc-500">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="signin-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="signin-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-3 text-gray-500 dark:bg-zinc-900 dark:text-zinc-500">New to Affisell?</span>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-zinc-400">
          <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}
