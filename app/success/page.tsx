"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"

function SuccessRedirect() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const welcome = searchParams.get("welcome") === "1"
  const { status } = useSession()
  const router = useRouter()
  const [message, setMessage] = useState("Paiement confirmé. Redirection…")
  const startedRef = useRef(false)

  const walletPath = welcome
    ? "/marketplace/account/wallet?welcome=1"
    : "/marketplace/account/wallet"
  const loginPath = `/login?callbackUrl=${encodeURIComponent(walletPath)}`

  useEffect(() => {
    if (startedRef.current) return
    if (status === "loading") return

    startedRef.current = true

    const redirect = () => {
      if (status === "authenticated") {
        router.replace(walletPath)
      } else {
        router.replace(loginPath)
      }
    }

    if (!sessionId) {
      redirect()
      return
    }

    fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      .then(() => redirect())
      .catch(() => {
        setMessage("Paiement reçu. Redirection…")
        redirect()
      })
  }, [sessionId, status, router, walletPath, loginPath])

  return <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-600">{message}</div>
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-zinc-600">
          Paiement confirmé. Redirection…
        </div>
      }
    >
      <SuccessRedirect />
    </Suspense>
  )
}
