/** Local dev buyer mode — fewer background polls + staggered prefetches. */
export function isDevLeanMode(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (process.env.AFFISELL_DEV_LEAN === "1" ||
      process.env.NEXT_PUBLIC_AFFISELL_DEV_LEAN === "1")
  )
}
