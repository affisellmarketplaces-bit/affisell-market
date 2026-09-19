/**
 * Category pill — reference design: translucent lavender pill, near-black label, outline icon in deep violet;
 * active = solid vivid violet with white label + icon. Keep every category rail on these tokens.
 */
export const CATEGORY_PILL_BAND = "bg-[#EBE8F7]/90 backdrop-blur-xl"

const BASE =
  "group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition"

export function categoryPillClass(active: boolean): string {
  return active
    ? `${BASE} bg-[#6728E8] text-white shadow-[0_6px_16px_-6px_rgba(103,40,232,0.65)]`
    : `${BASE} bg-[#8B6ED6]/[0.22] text-[#03020F] hover:bg-[#8B6ED6]/[0.32]`
}

export function categoryPillIconClass(active: boolean): string {
  return active ? "text-white" : "text-[#472488]"
}
