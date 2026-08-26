export function scoreKycColor(score: number): "green" | "orange" | "red" {
  if (score > 80) return "green"
  if (score >= 50) return "orange"
  return "red"
}

export function scoreKycBadgeClass(score: number): string {
  const color = scoreKycColor(score)
  if (color === "green") return "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40"
  if (color === "orange") return "bg-amber-500/20 text-amber-200 ring-amber-400/40"
  return "bg-red-500/20 text-red-200 ring-red-400/40"
}
