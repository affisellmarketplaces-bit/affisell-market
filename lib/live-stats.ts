"use client"

import { useEffect, useMemo, useState } from "react"

export type LiveStats = {
  viewersNow: number
  viewsToday: number
  cartsLastHour: number
}

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function timeOfDayFactor(hours: number): number {
  // More traffic in lunch + evening, lighter overnight.
  if (hours < 6) return 0.6
  if (hours < 10) return 0.9
  if (hours < 14) return 1.2
  if (hours < 18) return 1
  if (hours < 23) return 1.35
  return 0.8
}

export function getLiveStats(seed: string, now = new Date()): LiveStats {
  const h = hashSeed(seed)
  const hours = now.getHours()
  const minuteBucket = Math.floor(now.getMinutes() / 10)
  const halfHourBucket = Math.floor(now.getMinutes() / 30)
  const dayBucket = Math.floor(now.getTime() / 86_400_000)
  const factor = timeOfDayFactor(hours)

  const waveA = ((h + minuteBucket * 17 + dayBucket) % 9) - 4
  const waveB = ((h + halfHourBucket * 29 + dayBucket * 3) % 7) - 3

  const baseViewers = 8 + (h % 26)
  const viewersNow = Math.max(4, Math.round(baseViewers * factor + waveA))

  const baseToday = 35 + (h % 120)
  const viewsToday = Math.max(viewersNow + 6, Math.round(baseToday * factor + waveB * 5))

  const cartsLastHour = Math.max(1, Math.round(viewersNow / 5 + ((h + minuteBucket) % 3)))

  return { viewersNow, viewsToday, cartsLastHour }
}

export function useLiveStats(seed: string): LiveStats {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return useMemo(() => getLiveStats(seed, now), [seed, now])
}
