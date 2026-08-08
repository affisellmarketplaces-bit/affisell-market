export type ShoeRow = { eu: number; us_m: number; us_w: number; uk: number; cm: number; mp: number }

export const SHOE_CHART: ShoeRow[] = [
  { eu: 35, us_m: 3, us_w: 4.5, uk: 2.5, cm: 22.1, mp: 221 },
  { eu: 35.5, us_m: 3.5, us_w: 5, uk: 3, cm: 22.4, mp: 224 },
  { eu: 36, us_m: 4, us_w: 5.5, uk: 3.5, cm: 22.9, mp: 229 },
  { eu: 36.5, us_m: 4.5, us_w: 6, uk: 4, cm: 23.2, mp: 232 },
  { eu: 37, us_m: 5, us_w: 6.5, uk: 4.5, cm: 23.5, mp: 235 },
  { eu: 38, us_m: 5.5, us_w: 7, uk: 5, cm: 24.1, mp: 241 },
  { eu: 39, us_m: 6.5, us_w: 8, uk: 6, cm: 24.8, mp: 248 },
  { eu: 40, us_m: 7, us_w: 8.5, uk: 6.5, cm: 25.4, mp: 254 },
  { eu: 41, us_m: 8, us_w: 9.5, uk: 7.5, cm: 26.0, mp: 260 },
  { eu: 42, us_m: 8.5, us_w: 10, uk: 8, cm: 26.7, mp: 267 },
  { eu: 43, us_m: 9.5, us_w: 11, uk: 9, cm: 27.3, mp: 273 },
  { eu: 44, us_m: 10, us_w: 11.5, uk: 9.5, cm: 28.0, mp: 280 },
  { eu: 45, us_m: 11, us_w: 12.5, uk: 10.5, cm: 28.6, mp: 286 },
  { eu: 46, us_m: 12, us_w: 13.5, uk: 11.5, cm: 29.2, mp: 292 },
  { eu: 47, us_m: 13, us_w: 14.5, uk: 12.5, cm: 30.0, mp: 300 },
  { eu: 48, us_m: 14, us_w: 15.5, uk: 13.5, cm: 30.8, mp: 308 },
]

export const BRAND_FIT: Record<string, { delta: number; note: string }> = {
  Nike: { delta: 0.5, note: "Taille petit — prends +0.5" },
  "Air Jordan": { delta: 0.5, note: "Taille petit" },
  Adidas: { delta: 0, note: "Taille juste" },
  "New Balance": { delta: -0.25, note: "Taille grand confort" },
  Puma: { delta: 0, note: "Taille juste" },
  Converse: { delta: -0.75, note: "Taille très grand" },
  Vans: { delta: 0, note: "Taille juste" },
}

export function findClosestByCm(cm: number) {
  return [...SHOE_CHART].sort((a,b)=> Math.abs(a.cm-cm) - Math.abs(b.cm-cm))[0]
}
