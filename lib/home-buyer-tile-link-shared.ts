/** Full-tile hit target — deck visuals must not steal pointer events from the parent link. */
export const buyerServiceTileLinkClass =
  "relative z-[1] cursor-pointer [&_*]:pointer-events-none after:absolute after:inset-0 after:z-[2] after:rounded-2xl after:content-['']"
