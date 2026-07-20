import type { WorldCountryDef } from "@/lib/radar/world-countries"
import { getWorldCountry } from "@/lib/radar/world-countries"

export type MockWinnerSeed = {
  title: string
  source: string
  category: string
  price: number
  growthRate: number
  searches: number
  competition: number
  image: string
}

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=120&h=120&fit=crop&q=80`

/** Curated bestseller templates per country — localized titles, realistic metrics. */
const COUNTRY_WINNER_TEMPLATES: Record<string, MockWinnerSeed[]> = {
  FR: [
    { title: "Bande LED RGB WiFi 5m", source: "Amazon FR", category: "Maison", price: 24.99, growthRate: 127, searches: 22100, competition: 4, image: UNSPLASH("1558618666-fcd25c85cd64") },
    { title: "Coque MagSafe iPhone 15 Pro", source: "TikTok FR", category: "Tech", price: 14.9, growthRate: 98, searches: 18400, competition: 12, image: UNSPLASH("1601784551446-20c9b0957638") },
    { title: "Shapewear ventre plat seamless", source: "Amazon FR", category: "Mode", price: 29.5, growthRate: 89, searches: 15600, competition: 6, image: UNSPLASH("1434389676619-20d6adf125a9") },
    { title: "Gourde inox isotherme 1L", source: "Google FR", category: "Sport", price: 19.99, growthRate: 72, searches: 9800, competition: 3, image: UNSPLASH("1602143407151-7111542de6e8") },
    { title: "Airfryer sans huile 5L", source: "Amazon FR", category: "Cuisine", price: 89.0, growthRate: 115, searches: 24500, competition: 8, image: UNSPLASH("1585515657181-1c9d0c6c0b0e") },
    { title: "Tapis de marche pliable", source: "TikTok FR", category: "Fitness", price: 149.0, growthRate: 64, searches: 11200, competition: 5, image: UNSPLASH("1576678927484-cc907957088c") },
    { title: "Diffuseur huiles essentielles", source: "Amazon FR", category: "Maison", price: 32.0, growthRate: 55, searches: 7600, competition: 9, image: UNSPLASH("1602927651549-7071bce77558") },
    { title: "Montre connectée AMOLED", source: "Google FR", category: "Tech", price: 59.99, growthRate: 81, searches: 14300, competition: 14, image: UNSPLASH("1523275335684-37898b6baf30") },
    { title: "Organisateur tiroir cuisine", source: "Amazon FR", category: "Maison", price: 18.5, growthRate: 47, searches: 6200, competition: 2, image: UNSPLASH("1556909114-f6e7ad7d4046") },
    { title: "Lampe bureau sans fil USB-C", source: "TikTok FR", category: "Bureau", price: 34.9, growthRate: 93, searches: 8900, competition: 7, image: UNSPLASH("1507473886341-adc5e4f1a0b0") },
  ],
  DE: [
    { title: "LED Strip RGB Alexa 10m", source: "Amazon DE", category: "Smart Home", price: 22.99, growthRate: 134, searches: 19800, competition: 5, image: UNSPLASH("1558618666-fcd25c85cd64") },
    { title: "Kaffeevollautomat kompakt", source: "Amazon DE", category: "Küche", price: 299.0, growthRate: 76, searches: 12400, competition: 11, image: UNSPLASH("1495474473867-ceeb7899623a") },
    { title: "MagSafe Hülle iPhone 15", source: "TikTok DE", category: "Tech", price: 12.99, growthRate: 102, searches: 16700, competition: 8, image: UNSPLASH("1601784551446-20c9b0957638") },
    { title: "Luftreiniger HEPA", source: "Google DE", category: "Haushalt", price: 89.99, growthRate: 88, searches: 9100, competition: 6, image: UNSPLASH("1585771726004-7e5ac7a846af") },
    { title: "Yoga Matte rutschfest", source: "Amazon DE", category: "Sport", price: 24.5, growthRate: 61, searches: 7800, competition: 4, image: UNSPLASH("1592432678018-3640f0c4e2d5") },
    { title: "Bluetooth Kopfhörer ANC", source: "Amazon DE", category: "Audio", price: 49.99, growthRate: 95, searches: 21300, competition: 18, image: UNSPLASH("1505740420928-5e560c06d30e") },
    { title: "Wasserkocher Glas 1.7L", source: "TikTok DE", category: "Küche", price: 34.0, growthRate: 52, searches: 5400, competition: 3, image: UNSPLASH("1564758871473-4d021fb13723") },
    { title: "Bürostuhl ergonomisch", source: "Amazon DE", category: "Büro", price: 189.0, growthRate: 69, searches: 10200, competition: 9, image: UNSPLASH("1580480052353-722f8f5648dd") },
  ],
  US: [
    { title: "LED Strip Lights RGB 65ft", source: "Amazon US", category: "Home", price: 19.99, growthRate: 142, searches: 42000, competition: 22, image: UNSPLASH("1558618666-fcd25c85cd64") },
    { title: "Shapewear High-Waist Seamless", source: "TikTok US", category: "Fashion", price: 24.99, growthRate: 118, searches: 38000, competition: 15, image: UNSPLASH("1434389676619-20d6adf125a9") },
    { title: "MagSafe Phone Case Clear", source: "Amazon US", category: "Tech", price: 12.99, growthRate: 105, searches: 31000, competition: 28, image: UNSPLASH("1601784551446-20c9b0957638") },
    { title: "Portable Blender USB-C", source: "TikTok US", category: "Kitchen", price: 29.99, growthRate: 91, searches: 22000, competition: 7, image: UNSPLASH("1571019613454-1cb932f1b4cc") },
    { title: "Neck Massager Heated", source: "Amazon US", category: "Wellness", price: 34.99, growthRate: 87, searches: 18500, competition: 11, image: UNSPLASH("1544161515-4ab6ce6db874") },
    { title: "Stanley Tumbler Dupe 40oz", source: "TikTok US", category: "Lifestyle", price: 18.99, growthRate: 156, searches: 52000, competition: 19, image: UNSPLASH("1602143407151-7111542de6e8") },
    { title: "Mini Projector 4K WiFi", source: "Amazon US", category: "Electronics", price: 79.99, growthRate: 73, searches: 14600, competition: 13, image: UNSPLASH("1593359672878-221d75e14e8f") },
    { title: "Walking Pad Under Desk", source: "Google US", category: "Fitness", price: 189.0, growthRate: 124, searches: 27400, competition: 8, image: UNSPLASH("1576678927484-cc907957088c") },
  ],
  UK: [
    { title: "LED Strip Lights RGB 10m", source: "Amazon UK", category: "Home", price: 16.99, growthRate: 119, searches: 19200, competition: 6, image: UNSPLASH("1558618666-fcd25c85cd64") },
    { title: "Heated Throw Blanket", source: "TikTok UK", category: "Home", price: 39.99, growthRate: 96, searches: 14800, competition: 4, image: UNSPLASH("1555041469-a586c61e9bc0") },
    { title: "MagSafe Case iPhone 15", source: "Amazon UK", category: "Tech", price: 11.99, growthRate: 88, searches: 16500, competition: 10, image: UNSPLASH("1601784551446-20c9b0957638") },
    { title: "Air Fryer 6L Dual Zone", source: "Amazon UK", category: "Kitchen", price: 99.0, growthRate: 107, searches: 23100, competition: 9, image: UNSPLASH("1585515657181-1c9d0c6c0b0e") },
    { title: "Electric Scooter Adult", source: "Google UK", category: "Mobility", price: 349.0, growthRate: 62, searches: 8900, competition: 12, image: UNSPLASH("1558618666-fcd25c85cd64") },
  ],
  JP: [
    { title: "MagSafe iPhone ケース クリア", source: "Amazon JP", category: "Tech", price: 1980, growthRate: 112, searches: 28400, competition: 16, image: UNSPLASH("1601784551446-20c9b0957638") },
    { title: "コンパクト加湿器 静音", source: "Rakuten", category: "Home", price: 2980, growthRate: 78, searches: 12300, competition: 5, image: UNSPLASH("1602927651549-7071bce77558") },
    { title: "ワイヤレスイヤホン ノイキャン", source: "Amazon JP", category: "Audio", price: 4980, growthRate: 94, searches: 19800, competition: 21, image: UNSPLASH("1505740420928-5e560c06d30e") },
    { title: "折りたたみトレッドミル", source: "TikTok JP", category: "Fitness", price: 29800, growthRate: 86, searches: 8700, competition: 7, image: UNSPLASH("1576678927484-cc907957088c") },
    { title: "ステンレス水筒 500ml", source: "Amazon JP", category: "Outdoor", price: 2480, growthRate: 65, searches: 9600, competition: 3, image: UNSPLASH("1602143407151-7111542de6e8") },
  ],
  BR: [
    { title: "Cinta Modeladora Alta Compressão", source: "Shopee BR", category: "Moda", price: 49.9, growthRate: 138, searches: 35200, competition: 14, image: UNSPLASH("1434389676619-20d6adf125a9") },
    { title: "Fita LED RGB 5m WiFi", source: "Mercado Livre", category: "Casa", price: 39.99, growthRate: 121, searches: 21800, competition: 8, image: UNSPLASH("1558618666-fcd25c85cd64") },
    { title: "Air Fryer 4.5L Digital", source: "Amazon BR", category: "Cozinha", price: 299.0, growthRate: 99, searches: 27600, competition: 11, image: UNSPLASH("1585515657181-1c9d0c6c0b0e") },
    { title: "Fone Bluetooth TWS ANC", source: "TikTok BR", category: "Tech", price: 89.9, growthRate: 83, searches: 19400, competition: 19, image: UNSPLASH("1505740420928-5e560c06d30e") },
    { title: "Garrafa Térmica Inox 1L", source: "Shopee BR", category: "Esporte", price: 59.9, growthRate: 71, searches: 11200, competition: 4, image: UNSPLASH("1602143407151-7111542de6e8") },
  ],
  MA: [
    { title: "Gourde inox isotherme 1L", source: "Jumia MA", category: "Sport", price: 149.0, growthRate: 92, searches: 8400, competition: 3, image: UNSPLASH("1602143407151-7111542de6e8") },
    { title: "Coque MagSafe iPhone", source: "Amazon MA", category: "Tech", price: 89.0, growthRate: 76, searches: 6200, competition: 5, image: UNSPLASH("1601784551446-20c9b0957638") },
    { title: "Bande LED RGB 5m", source: "TikTok MA", category: "Maison", price: 119.0, growthRate: 108, searches: 9800, competition: 6, image: UNSPLASH("1558618666-fcd25c85cd64") },
    { title: "Diffuseur huiles essentielles", source: "Jumia MA", category: "Maison", price: 199.0, growthRate: 58, searches: 4100, competition: 2, image: UNSPLASH("1602927651549-7071bce77558") },
    { title: "Montre connectée sport", source: "Google MA", category: "Tech", price: 299.0, growthRate: 84, searches: 7300, competition: 7, image: UNSPLASH("1523275335684-37898b6baf30") },
  ],
}

const GENERIC_TEMPLATES: MockWinnerSeed[] = [
  { title: "Wireless Earbuds ANC", source: "Amazon", category: "Electronics", price: 39.99, growthRate: 95, searches: 15000, competition: 12, image: UNSPLASH("1505740420928-5e560c06d30e") },
  { title: "LED Strip RGB Smart", source: "TikTok", category: "Home", price: 18.99, growthRate: 110, searches: 18000, competition: 8, image: UNSPLASH("1558618666-fcd25c85cd64") },
  { title: "Phone Case MagSafe", source: "Amazon", category: "Accessories", price: 14.99, growthRate: 88, searches: 12000, competition: 15, image: UNSPLASH("1601784551446-20c9b0957638") },
  { title: "Portable Blender USB", source: "Google", category: "Kitchen", price: 27.99, growthRate: 72, searches: 9000, competition: 5, image: UNSPLASH("1571019613454-1cb932f1b4cc") },
  { title: "Fitness Tracker Band", source: "Amazon", category: "Wearables", price: 49.99, growthRate: 66, searches: 11000, competition: 9, image: UNSPLASH("1523275335684-37898b6baf30") },
  { title: "Air Fryer Compact", source: "TikTok", category: "Kitchen", price: 79.99, growthRate: 103, searches: 20000, competition: 10, image: UNSPLASH("1585515657181-1c9d0c6c0b0e") },
  { title: "Insulated Water Bottle", source: "Amazon", category: "Outdoor", price: 22.99, growthRate: 59, searches: 7000, competition: 4, image: UNSPLASH("1602143407151-7111542de6e8") },
  { title: "Yoga Mat Non-Slip", source: "Google", category: "Fitness", price: 24.99, growthRate: 54, searches: 6500, competition: 6, image: UNSPLASH("1592432678018-3640f0c4e2d5") },
  { title: "Desk Lamp Wireless", source: "TikTok", category: "Office", price: 32.99, growthRate: 81, searches: 8500, competition: 7, image: UNSPLASH("1507473886341-adc5e4f1a0b0") },
  { title: "Mini Projector WiFi", source: "Amazon", category: "Electronics", price: 69.99, growthRate: 77, searches: 13000, competition: 11, image: UNSPLASH("1593359672878-221d75e14e8f") },
]

const COUNTRY_TRENDING: Record<string, Array<{ keyword: string; growthRate: number; volume: number }>> = {
  FR: [
    { keyword: "led strip rgb", growthRate: 89, volume: 22100 },
    { keyword: "shapewear", growthRate: 67, volume: 15600 },
    { keyword: "coque magsafe", growthRate: 78, volume: 18400 },
    { keyword: "airfryer 5l", growthRate: 88, volume: 24500 },
    { keyword: "gourde inox", growthRate: 55, volume: 9800 },
  ],
  DE: [
    { keyword: "led strip alexa", growthRate: 92, volume: 19800 },
    { keyword: "luftreiniger hepa", growthRate: 74, volume: 9100 },
    { keyword: "kaffeevollautomat", growthRate: 61, volume: 12400 },
    { keyword: "yoga matte", growthRate: 58, volume: 7800 },
    { keyword: "kopfhörer anc", growthRate: 85, volume: 21300 },
  ],
  US: [
    { keyword: "stanley tumbler dupe", growthRate: 156, volume: 52000 },
    { keyword: "walking pad", growthRate: 124, volume: 27400 },
    { keyword: "shapewear", growthRate: 118, volume: 38000 },
    { keyword: "led strip lights", growthRate: 142, volume: 42000 },
    { keyword: "portable blender", growthRate: 91, volume: 22000 },
  ],
  UK: [
    { keyword: "heated throw blanket", growthRate: 96, volume: 14800 },
    { keyword: "air fryer dual zone", growthRate: 107, volume: 23100 },
    { keyword: "led strip lights", growthRate: 119, volume: 19200 },
    { keyword: "magsafe case", growthRate: 88, volume: 16500 },
    { keyword: "electric scooter", growthRate: 62, volume: 8900 },
  ],
  JP: [
    { keyword: "magsafe ケース", growthRate: 112, volume: 28400 },
    { keyword: "加湿器 静音", growthRate: 78, volume: 12300 },
    { keyword: "ノイキャン イヤホン", growthRate: 94, volume: 19800 },
    { keyword: "トレッドミル 折りたたみ", growthRate: 86, volume: 8700 },
    { keyword: "水筒 ステンレス", growthRate: 65, volume: 9600 },
  ],
  BR: [
    { keyword: "cinta modeladora", growthRate: 138, volume: 35200 },
    { keyword: "fita led rgb", growthRate: 121, volume: 21800 },
    { keyword: "air fryer", growthRate: 99, volume: 27600 },
    { keyword: "fone bluetooth", growthRate: 83, volume: 19400 },
    { keyword: "garrafa térmica", growthRate: 71, volume: 11200 },
  ],
  MA: [
    { keyword: "gourde inox", growthRate: 92, volume: 8400 },
    { keyword: "bande led rgb", growthRate: 108, volume: 9800 },
    { keyword: "coque magsafe", growthRate: 76, volume: 6200 },
    { keyword: "montre connectée", growthRate: 84, volume: 7300 },
    { keyword: "diffuseur huiles", growthRate: 58, volume: 4100 },
  ],
}

function jitter(value: number, pct = 0.08): number {
  const delta = value * pct * (Math.random() * 2 - 1)
  return Math.max(1, Math.round(value + delta))
}

function trendingScoreFrom(seed: MockWinnerSeed, rank: number): number {
  const base = seed.growthRate * 0.6 + Math.min(seed.searches / 500, 40) - seed.competition
  return Math.min(100, Math.max(10, Math.round(base - rank * 0.5 + Math.random() * 5)))
}

export function buildMockWinnersForCountry(
  countryCode: string,
  limit = 20
): Array<{
  countryCode: string
  rank: number
  title: string
  image: string | null
  source: string
  price: number | null
  currency: string
  growthRate: number | null
  searches: number | null
  competition: number | null
  trendingScore: number
  category: string | null
}> {
  const country = getWorldCountry(countryCode)
  const currency = country?.currency ?? "USD"
  const base = COUNTRY_WINNER_TEMPLATES[countryCode] ?? GENERIC_TEMPLATES
  const pool = [...base]
  while (pool.length < limit) {
    const g = GENERIC_TEMPLATES[pool.length % GENERIC_TEMPLATES.length]
    if (!g) break
    pool.push({
      ...g,
      title: `${g.title} · ${countryCode} #${pool.length + 1}`,
      source: g.source.includes("Amazon")
        ? `Amazon ${countryCode}`
        : `${g.source} ${countryCode}`,
    })
  }
  const templates = pool.slice(0, limit)
  const now = Date.now()

  return templates.map((seed, index) => {
    const rank = index + 1
    const growthRate = jitter(seed.growthRate, 0.05)
    const searches = jitter(seed.searches, 0.06)
    const competition = jitter(seed.competition, 0.1)
    const price = jitter(seed.price, 0.03)
    return {
      countryCode: countryCode.toUpperCase(),
      rank,
      title: seed.title,
      image: `${seed.image}&t=${now}`,
      source: seed.source
        .replace(/Amazon/gi, "Signaux e-commerce")
        .replace(/TikTok/gi, "Signaux social")
        .replace(/Google/gi, "Signaux search"),
      price,
      currency,
      growthRate,
      searches,
      competition,
      trendingScore: trendingScoreFrom({ ...seed, growthRate, searches, competition }, rank),
      category: seed.category,
    }
  })
}

export function buildMockTrendingForCountry(countryCode: string): Array<{
  countryCode: string
  keyword: string
  growthRate: number
  volume: number | null
}> {
  const base = COUNTRY_TRENDING[countryCode] ?? COUNTRY_TRENDING.FR

  return base.slice(0, 5).map((row) => ({
    countryCode: countryCode.toUpperCase(),
    keyword: row.keyword,
    growthRate: jitter(row.growthRate, 0.04),
    volume: jitter(row.volume, 0.05),
  }))
}

export function localizeGenericTemplates(country: WorldCountryDef): MockWinnerSeed[] {
  return GENERIC_TEMPLATES.map((t) => ({
    ...t,
    source: t.source.includes("Amazon") ? `Amazon ${country.code}` : `${t.source} ${country.code}`,
  }))
}
