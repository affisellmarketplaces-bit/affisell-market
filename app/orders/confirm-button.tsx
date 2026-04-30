'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ConfirmButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    if (!confirm('Confirmer la réception ?')) return
    setLoading(true)
    try {
      await fetch(`/api/orders/${orderId}/confirm`, { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? '...' : "J'ai reçu"}
    </button>
  )
}
