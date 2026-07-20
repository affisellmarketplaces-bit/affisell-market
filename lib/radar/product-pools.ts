/**
 * World Radar V2 — 150 product archetypes × cultural affinity.
 * Client-safe (no server-only).
 */

export const PRODUCT_CATEGORIES = [
  "beauty",
  "home_deco",
  "pet",
  "car_accessories",
  "modest_fashion",
  "kawaii_tech",
  "outdoor",
  "baby",
  "fitness",
  "kitchen_gadget",
  "phone_accessories",
  "wellness",
  "party_deco",
  "eco_home",
  "office",
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export type LocalizedTitle = {
  EN: string
  FR?: string
  DE?: string
  US?: string
  UK?: string
  JP?: string
  KR?: string
  SA?: string
  AE?: string
  MA?: string
  EG?: string
  BR?: string
  MX?: string
  ES?: string
  IT?: string
  IN?: string
  ID?: string
  VN?: string
  AU?: string
  CN?: string
  SE?: string
  NL?: string
  SG?: string
  CO?: string
  NZ?: string
  CA?: string
  BE?: string
  PT?: string
  PL?: string
  AR?: string
  ZA?: string
  NG?: string
}

export type ProductArchetype = {
  id: string
  title: LocalizedTitle
  category: ProductCategory
  tags: string[]
  basePrice: number
  seasonality: number[]
  /** 0–1 affinity by country code; missing → 0.12 default (low = cultural mismatch) */
  culturalAffinity: Partial<Record<string, number>>
  arbitragePotential: number
}

type AffinityPreset =
  | "mena"
  | "asia_east"
  | "us_anglo"
  | "latam"
  | "eu_nordic"
  | "eu_latin"
  | "sea"
  | "global"

const PRESETS: Record<AffinityPreset, Partial<Record<string, number>>> = {
  mena: {
    SA: 0.95, AE: 0.95, MA: 0.9, EG: 0.9, ZA: 0.45, FR: 0.3, US: 0.15,
    JP: 0.05, KR: 0.05, SG: 0.1, BR: 0.1, MX: 0.1, DE: 0.1, AU: 0.1,
  },
  asia_east: {
    JP: 0.95, KR: 0.95, SG: 0.85, CN: 0.7, VN: 0.55, US: 0.4, FR: 0.35,
    SA: 0.1, AE: 0.12, MA: 0.1, EG: 0.1, BR: 0.25, DE: 0.3,
  },
  us_anglo: {
    US: 0.95, CA: 0.9, AU: 0.9, NZ: 0.85, UK: 0.7, DE: 0.45, FR: 0.4,
    JP: 0.25, SA: 0.15, MA: 0.15, BR: 0.45,
  },
  latam: {
    BR: 0.95, MX: 0.9, CO: 0.85, AR: 0.85, US: 0.5, ES: 0.55, PT: 0.5,
    JP: 0.15, SA: 0.1, KR: 0.15, FR: 0.3, DE: 0.25,
  },
  eu_nordic: {
    DE: 0.95, NL: 0.9, SE: 0.9, BE: 0.75, FR: 0.55, US: 0.4,
    JP: 0.25, SA: 0.1, BR: 0.2, AU: 0.35,
  },
  eu_latin: {
    FR: 0.95, IT: 0.9, ES: 0.9, PT: 0.85, BE: 0.7, DE: 0.45,
    JP: 0.2, SA: 0.15, US: 0.35, BR: 0.4,
  },
  sea: {
    IN: 0.9, ID: 0.9, VN: 0.85, SG: 0.6, CN: 0.55, AE: 0.4,
    JP: 0.2, SA: 0.35, MA: 0.4, US: 0.25, FR: 0.25,
  },
  global: { US: 0.7, FR: 0.65, DE: 0.65, JP: 0.6, BR: 0.6, UK: 0.65, SA: 0.45 },
}

function item(
  id: string,
  category: ProductCategory,
  title: LocalizedTitle,
  basePrice: number,
  affinity: AffinityPreset,
  opts?: {
    tags?: string[]
    seasonality?: number[]
    arbitragePotential?: number
    extraAffinity?: Partial<Record<string, number>>
  }
): ProductArchetype {
  return {
    id,
    category,
    title,
    basePrice,
    tags: opts?.tags ?? ["evergreen"],
    seasonality: opts?.seasonality ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    culturalAffinity: { ...PRESETS[affinity], ...opts?.extraAffinity },
    arbitragePotential: opts?.arbitragePotential ?? 82,
  }
}

/** 150 archetypes — culturally differentiated titles. */
export const PRODUCT_POOL: ProductArchetype[] = [
  // ── beauty (10)
  item("beauty-k-serum", "beauty", { EN: "Korean Glass Skin Serum", FR: "Sérum glass skin Corée", JP: "ガラ肌セラム", KR: "글래스 스킨 세럼", US: "K-Beauty Glass Serum" }, 24, "asia_east", { tags: ["tiktok_viral", "amazon_best"], arbitragePotential: 92 }),
  item("beauty-shapewear", "beauty", { EN: "High-Waist Shapewear", FR: "Shapewear ventre plat", BR: "Cinta modeladora alta", MX: "Faja reductora", US: "Seamless Shapewear" }, 28, "latam", { tags: ["tiktok_viral"], seasonality: [1, 2, 5, 6, 11, 12], arbitragePotential: 90, extraAffinity: { US: 0.85, FR: 0.7 } }),
  item("beauty-hair-straightener", "beauty", { EN: "Ceramic Hair Straightener", BR: "Prancha cerâmica", MX: "Plancha de pelo", FR: "Lisseur céramique" }, 35, "latam", { tags: ["amazon_best"], arbitragePotential: 84 }),
  item("beauty-jade-roller", "beauty", { EN: "Jade Face Roller Set", FR: "Rouleau jade visage", JP: "翡翠ローラー", US: "Jade Roller Kit" }, 14, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 86 }),
  item("beauty-led-mask", "beauty", { EN: "LED Light Therapy Mask", FR: "Masque LED photothérapie", US: "LED Face Mask", KR: "LED 마스크" }, 49, "asia_east", { tags: ["tiktok_viral", "summer"], seasonality: [5, 6, 7, 8], arbitragePotential: 91 }),
  item("beauty-pharma-cream", "beauty", { EN: "Derm Pharma Night Cream", FR: "Crème nuit dermato", IT: "Crema notte farmacia", ES: "Crema noche derm" }, 22, "eu_latin", { tags: ["evergreen"], arbitragePotential: 80 }),
  item("beauty-microneedle", "beauty", { EN: "Hydra Microneedle Patches", KR: "하이드라 패치", JP: "マイクロニードルパッチ", FR: "Patches microneedling" }, 22, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 91 }),
  item("beauty-eyelash-jp", "beauty", { EN: "Heated Eyelash Curler", JP: "ホットビューラー", KR: "속눈썹 고데기", FR: "Recourbe-cils chauffant" }, 19, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 88 }),
  item("beauty-hair-tools-us", "beauty", { EN: "Hot Air Styler Brush", US: "Hot Air Brush Styler", UK: "Hot air styler", AU: "Hot air brush" }, 42, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 87 }),
  item("beauty-nail-uv", "beauty", { EN: "UV Nail Lamp Mini", FR: "Lampe UV ongles mini", JP: "UVネイルライト", US: "Mini UV Nail Lamp" }, 19, "global", { tags: ["tiktok_viral"], arbitragePotential: 81 }),

  // ── home_deco (10)
  item("home-led-rgb", "home_deco", { EN: "RGB LED Strip 10m", FR: "Ruban LED RGB 10m", DE: "LED Strip RGB 10m", US: "RGB LED Strip Lights 32ft", JP: "RGB LEDテープ 10m" }, 12.5, "global", { tags: ["tiktok_viral", "amazon_best", "summer"], seasonality: [5, 6, 7, 8, 11, 12], arbitragePotential: 88 }),
  item("home-minimal-shelf", "home_deco", { EN: "Minimal Wall Shelf Oak", FR: "Étagère murale chêne", DE: "Wandregal Eiche", SE: "Minimal hylla ek", JP: "オーク壁棚" }, 45, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 79, extraAffinity: { JP: 0.7 } }),
  item("home-anime-led", "home_deco", { EN: "Anime Neon LED Sign", JP: "アニメネオンLED", KR: "애니 네온 LED", US: "Anime LED Neon", SG: "Anime neon LED" }, 29, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 93 }),
  item("home-chic-vase", "home_deco", { EN: "Ceramic Speckle Vase", FR: "Vase céramique chiné", IT: "Vaso ceramica", ES: "Jarrón cerámica" }, 32, "eu_latin", { tags: ["evergreen"], arbitragePotential: 78 }),
  item("home-storage-cube", "home_deco", { EN: "Fabric Storage Cubes 6pk", DE: "Stoffboxen 6er", NL: "Opbergdozen 6-pack", FR: "Cubes rangement x6" }, 21, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 80 }),
  item("home-party-balloon", "home_deco", { EN: "LED Balloon Arch Kit", BR: "Arco balões LED", MX: "Arco de globos LED", CO: "Arco globos LED" }, 27, "latam", { tags: ["tiktok_viral"], seasonality: [11, 12, 1, 2], arbitragePotential: 86 }),
  item("home-humidifier-kawaii", "home_deco", { EN: "Kawaii Cat Humidifier", JP: "猫加湿器かわいい", KR: "고양이 가습기", SG: "Kawaii humidifier" }, 23, "asia_east", { tags: ["tiktok_viral"], seasonality: [10, 11, 12, 1, 2], arbitragePotential: 92 }),
  item("home-desk-lamp", "home_deco", { EN: "Wireless Desk Lamp USB-C", FR: "Lampe bureau USB-C", DE: "Schreibtischlampe USB-C", US: "Wireless desk lamp" }, 34, "global", { tags: ["amazon_best"], arbitragePotential: 83 }),
  item("home-oud-diffuser", "home_deco", { EN: "Oud Bakhoor Diffuser Set", SA: "مبخرة عود", AE: "Oud diffuser", MA: "Diffuseur oud", EG: "مبخرة" }, 29, "mena", { tags: ["evergreen"], arbitragePotential: 90 }),
  item("home-prayer-mat-tech", "home_deco", { EN: "Smart Prayer Mat Guide", SA: "سجادة صلاة ذكية", AE: "Smart prayer mat", EG: "سجادة صلاة", MA: "Tapis prière tech" }, 55, "mena", { tags: ["evergreen"], arbitragePotential: 94 }),

  // ── pet (10)
  item("pet-costume-us", "pet", { EN: "Dog Halloween Costume", US: "Dog costume Halloween", CA: "Dog costume", AU: "Pet costume", JP: "犬コスチューム" }, 15, "us_anglo", { tags: ["tiktok_viral"], seasonality: [9, 10, 11], arbitragePotential: 87, extraAffinity: { JP: 0.75 } }),
  item("pet-feeder-auto", "pet", { EN: "Auto Pet Feeder Camera", US: "Smart pet feeder", JP: "自動給餌器カメラ", FR: "Distributeur auto caméra" }, 69, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 85 }),
  item("pet-carrier-jp", "pet", { EN: "Transparent Pet Backpack", JP: "ペット透明リュック", KR: "투명 펫백팩", US: "Clear pet backpack" }, 38, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 88 }),
  item("pet-grooming-kit", "pet", { EN: "Pet Grooming Vacuum Kit", DE: "Tierhaarstaubsauger", US: "Pet grooming vacuum", FR: "Aspirateur toilettage" }, 52, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 82, extraAffinity: { US: 0.8 } }),
  item("pet-orthopedic-bed", "pet", { EN: "Orthopedic Dog Bed", US: "Orthopedic dog bed", UK: "Orthopedic pet bed", DE: "Orthopädisches Hundebett" }, 44, "us_anglo", { tags: ["evergreen"], arbitragePotential: 79 }),
  item("pet-gps-collar", "pet", { EN: "GPS Pet Tracker Collar", FR: "Collier GPS animal", US: "GPS pet collar", JP: "GPS首輪" }, 59, "global", { tags: ["amazon_best"], arbitragePotential: 84 }),
  item("pet-slow-feeder", "pet", { EN: "Slow Feeder Puzzle Bowl", US: "Slow feeder bowl", FR: "Gamelle anti-glouton", DE: "Anti-Schling Napf" }, 12, "global", { tags: ["evergreen"], arbitragePotential: 76 }),
  item("pet-cooling-mat", "pet", { EN: "Pet Cooling Mat", AU: "Pet cooling mat", US: "Cooling pet mat", AE: "Pet cooling pad" }, 18, "us_anglo", { tags: ["summer"], seasonality: [5, 6, 7, 8], arbitragePotential: 83, extraAffinity: { AE: 0.8, SA: 0.75 } }),
  item("pet-litter-auto", "pet", { EN: "Self-Cleaning Litter Box", US: "Auto litter box", JP: "自動トイレ", FR: "Litière auto-nettoyante" }, 149, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 90, extraAffinity: { US: 0.85 } }),
  item("pet-treat-dispenser", "pet", { EN: "Smart Treat Dispenser", US: "Treat dispenser cam", UK: "Smart treat cam", CA: "Pet treat cam" }, 48, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 81 }),

  // ── car_accessories (10)
  item("car-detail-kit", "car_accessories", { EN: "Car Detailing Foam Kit", US: "Foam cannon kit", DE: "Auto Pflege Set", AE: "Car detailing kit", AU: "Detailing foam kit" }, 39, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 86, extraAffinity: { DE: 0.9, AE: 0.88, SA: 0.7 } }),
  item("car-phone-mount", "car_accessories", { EN: "MagSafe Car Mount", FR: "Support MagSafe voiture", DE: "MagSafe Halterung", US: "MagSafe car mount" }, 22, "global", { tags: ["amazon_best"], arbitragePotential: 80 }),
  item("car-dash-cam", "car_accessories", { EN: "4K Dual Dash Cam", US: "4K dash cam dual", DE: "Dashcam 4K", AE: "Dash cam 4K", SA: "كاميرا سيارة 4K" }, 89, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 87, extraAffinity: { DE: 0.85, AE: 0.9 } }),
  item("car-seat-organizer", "car_accessories", { EN: "Backseat Organizer", DE: "Rücksitz Organizer", US: "Car seat organizer", FR: "Organiseur siège arrière" }, 17, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 77 }),
  item("car-led-interior", "car_accessories", { EN: "Interior Car LED Ambient", US: "Car ambient LED", AE: "Interior LED car", BR: "LED ambiente carro" }, 15, "global", { tags: ["tiktok_viral"], arbitragePotential: 84 }),
  item("car-tire-inflator", "car_accessories", { EN: "Portable Tire Inflator", US: "Tire inflator cordless", DE: "Kompressor Reifen", AU: "Portable tyre pump" }, 45, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 83, extraAffinity: { DE: 0.85 } }),
  item("car-sunshade", "car_accessories", { EN: "Windshield Sun Shade", AE: "Sun shade car", SA: "مظلة سيارة", US: "Car sun shade", AU: "Windscreen shade" }, 14, "mena", { tags: ["summer"], seasonality: [4, 5, 6, 7, 8, 9], arbitragePotential: 88, extraAffinity: { AU: 0.8, US: 0.7 } }),
  item("car-vacuum", "car_accessories", { EN: "Cordless Car Vacuum", DE: "Autostaubsauger", US: "Car vacuum cordless", UK: "Car vacuum" }, 36, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 81, extraAffinity: { US: 0.8 } }),
  item("car-bike-rack", "car_accessories", { EN: "Hitch Bike Rack", DE: "Fahrradträger", NL: "Fietsendrager", SE: "Cykelhållare" }, 129, "eu_nordic", { tags: ["summer"], seasonality: [4, 5, 6, 7, 8], arbitragePotential: 82 }),
  item("car-perfume-clip", "car_accessories", { EN: "Luxury Car Vent Perfume", SA: "عطر سيارة فاخر", AE: "Car vent perfume", FR: "Parfum voiture luxe" }, 11, "mena", { tags: ["evergreen"], arbitragePotential: 85 }),

  // ── modest_fashion (10)
  item("modest-abaya-steamer", "modest_fashion", { EN: "Travel Abaya Steamer", SA: "مكواة بخار عباية", AE: "Abaya steamer", MA: "Steamer abaya", EG: "مكواة عباية" }, 34, "mena", { tags: ["tiktok_viral"], arbitragePotential: 95 }),
  item("modest-abaya-fold", "modest_fashion", { EN: "Wrinkle-Free Travel Abaya", SA: "عباية سفر", AE: "Travel abaya", EG: "عباية سفر" }, 48, "mena", { tags: ["evergreen"], arbitragePotential: 91 }),
  item("modest-hijab-cap", "modest_fashion", { EN: "Undercap Hijab Bundle", SA: "طاقية حجاب", MA: "Bonnet hijab lot", ID: "Inner hijab set", IN: "Hijab undercap set" }, 12, "mena", { tags: ["evergreen"], arbitragePotential: 87, extraAffinity: { ID: 0.9, IN: 0.85 } }),
  item("modest-prayer-set", "modest_fashion", { EN: "Kids Prayer Outfit Set", SA: "طقم صلاة أطفال", EG: "طقم صلاة", MA: "Tenue prière enfant" }, 26, "mena", { tags: ["evergreen"], seasonality: [3, 4, 9], arbitragePotential: 86 }),
  item("modest-magnet-scarf", "modest_fashion", { EN: "Magnetic Scarf Clips", SA: "مشابك شال", AE: "Scarf magnets", FR: "Clips foulard magnétiques" }, 8, "mena", { tags: ["tiktok_viral"], arbitragePotential: 84 }),
  item("modest-swim-burkini", "modest_fashion", { EN: "Modest Swim Burkini", SA: "بوركيني", AE: "Burkini", MA: "Burkini", FR: "Burkini" }, 42, "mena", { tags: ["summer"], seasonality: [5, 6, 7, 8], arbitragePotential: 89, extraAffinity: { FR: 0.55 } }),
  item("modest-organizer-sari", "modest_fashion", { EN: "Sari Organizer Closet", IN: "Sari organizer", ID: "Organizer kebaya", VN: "Tủ xếp áo dài" }, 19, "sea", { tags: ["evergreen"], arbitragePotential: 88 }),
  item("modest-abaya-hanger", "modest_fashion", { EN: "Wide Shoulder Abaya Hangers", SA: "علاقات عباية", AE: "Abaya hangers", EG: "علاقات عباية" }, 14, "mena", { tags: ["evergreen"], arbitragePotential: 82 }),
  item("modest-hijab-pins", "modest_fashion", { EN: "Magnetic Hijab Pins Set", SA: "دبابيس حجاب مغناطيسية", MA: "Épingles hijab magnétiques", EG: "دبابيس حجاب", IN: "Hijab magnetic pins" }, 9, "mena", { tags: ["evergreen"], arbitragePotential: 88, extraAffinity: { IN: 0.8, ID: 0.85 } }),
  item("modest-ramadan-lantern", "modest_fashion", { EN: "LED Ramadan Lantern", SA: "فانوس رمضان LED", AE: "Ramadan LED lantern", EG: "فانوس رمضان", MA: "Lanternes Ramadan LED" }, 21, "mena", { tags: ["tiktok_viral"], seasonality: [2, 3, 4], arbitragePotential: 93 }),

  // ── kawaii_tech (10)
  item("kawaii-humidifier", "kawaii_tech", { EN: "Round Kawaii Humidifier", JP: "かわいい加湿器", KR: "귀여운 가습기", SG: "Kawaii humidifier" }, 25, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 94 }),
  item("kawaii-bento", "kawaii_tech", { EN: "Bento Box Leakproof", JP: "弁当箱密閉", KR: "도시락", SG: "Bento lunch box" }, 28, "asia_east", { tags: ["amazon_best"], arbitragePotential: 88 }),
  item("kawaii-face-massager", "kawaii_tech", { EN: "Facial EMS Massager", JP: "EMS美顔器", KR: "EMS 마사지기", FR: "Massage visage EMS" }, 55, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 91 }),
  item("kawaii-keyboard", "kawaii_tech", { EN: "Pastel Mechanical Keyboard", JP: "パステルキーボード", KR: "파스텔 키보드", US: "Pastel mech keyboard" }, 69, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 85, extraAffinity: { US: 0.65 } }),
  item("kawaii-webcam-cover", "kawaii_tech", { EN: "Cute Webcam Cover Slide", JP: "ウェブカムカバー", KR: "웹캠 커버", SG: "Cute cam cover" }, 6, "asia_east", { tags: ["evergreen"], arbitragePotential: 78 }),
  item("kawaii-powerbank", "kawaii_tech", { EN: "Character Power Bank 10k", JP: "キャラモバイルバッテリー", KR: "캐릭터 보조배터리", CN: "卡通充电宝" }, 22, "asia_east", { tags: ["amazon_best"], arbitragePotential: 83 }),
  item("kawaii-ring-light", "kawaii_tech", { EN: "Mini Clip Ring Light", JP: "クリップリングライト", KR: "미니 링라이트", US: "Clip ring light" }, 14, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 86 }),
  item("kawaii-tablet-stand", "kawaii_tech", { EN: "Cat Paw Tablet Stand", JP: "猫足スタンド", KR: "고양이 스탠드", SG: "Cat paw stand" }, 16, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 84 }),
  item("kawaii-earbuds-case", "kawaii_tech", { EN: "3D Silicone Earbuds Case", JP: "イヤホンケース立体", KR: "이어버드 케이스", CN: "耳机套立体" }, 11, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 82 }),
  item("kawaii-monitor-light", "kawaii_tech", { EN: "Monitor Light Bar Soft", JP: "モニターライトバー", KR: "모니터 라이트바", US: "Monitor light bar" }, 39, "asia_east", { tags: ["amazon_best"], arbitragePotential: 87, extraAffinity: { US: 0.7, DE: 0.6 } }),

  // ── outdoor (10)
  item("outdoor-stanley-dupe", "outdoor", { EN: "40oz Insulated Tumbler", US: "Stanley-style tumbler 40oz", AU: "40oz tumbler", CA: "Insulated tumbler 40oz", UK: "40oz tumbler" }, 18, "us_anglo", { tags: ["tiktok_viral", "summer"], seasonality: [4, 5, 6, 7, 8, 9], arbitragePotential: 94 }),
  item("outdoor-bbq-tools", "outdoor", { EN: "BBQ Grill Tool Set", US: "BBQ tool set", AU: "BBQ tools", NZ: "BBQ set", DE: "Grillbesteck Set" }, 32, "us_anglo", { tags: ["summer"], seasonality: [5, 6, 7, 8], arbitragePotential: 85, extraAffinity: { DE: 0.75 } }),
  item("outdoor-camping-hammock", "outdoor", { EN: "Camping Hammock Double", US: "Double hammock", AU: "Camping hammock", FR: "Hamac camping double" }, 29, "us_anglo", { tags: ["summer"], seasonality: [5, 6, 7, 8], arbitragePotential: 82 }),
  item("outdoor-hiking-poles", "outdoor", { EN: "Carbon Hiking Poles", US: "Hiking poles carbon", DE: "Wanderstöcke", AU: "Trekking poles", NZ: "Hiking poles" }, 48, "us_anglo", { tags: ["evergreen"], arbitragePotential: 80, extraAffinity: { DE: 0.85, SE: 0.8 } }),
  item("outdoor-cooler-bag", "outdoor", { EN: "Soft Cooler Bag 30L", AU: "Soft cooler 30L", US: "Soft cooler", NZ: "Cooler bag", AE: "Cooler bag" }, 36, "us_anglo", { tags: ["summer"], seasonality: [5, 6, 7, 8, 9], arbitragePotential: 83, extraAffinity: { AE: 0.7 } }),
  item("outdoor-headlamp", "outdoor", { EN: "Rechargeable Headlamp", US: "Headlamp USB-C", DE: "Stirnlampe", AU: "Head torch" }, 19, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 79 }),
  item("outdoor-picnic-mat", "outdoor", { EN: "Waterproof Picnic Blanket", FR: "Couverture pique-nique", US: "Picnic blanket", AU: "Picnic rug" }, 24, "global", { tags: ["summer"], seasonality: [4, 5, 6, 7, 8], arbitragePotential: 78 }),
  item("outdoor-insect-repellent", "outdoor", { EN: "Wearable Mosquito Repeller", AU: "Mozzie repeller", US: "Mosquito clip", BR: "Repelente clip", VN: "Đuổi muỗi đeo" }, 13, "us_anglo", { tags: ["summer"], seasonality: [5, 6, 7, 8, 9], arbitragePotential: 84, extraAffinity: { BR: 0.8, VN: 0.85, ID: 0.8 } }),
  item("outdoor-solar-lantern", "outdoor", { EN: "Solar Camping Lantern", US: "Solar lantern", AU: "Solar camp light", ZA: "Solar lantern", NG: "Solar lamp" }, 21, "us_anglo", { tags: ["evergreen"], arbitragePotential: 86, extraAffinity: { ZA: 0.85, NG: 0.8 } }),
  item("outdoor-bike-lights", "outdoor", { EN: "USB Bike Light Set", DE: "Fahrradlicht Set", NL: "Fietsverlichting", SE: "Cykelbelysning", FR: "Éclairage vélo USB" }, 27, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 81 }),

  // ── baby (10)
  item("baby-monitor-wifi", "baby", { EN: "WiFi Baby Monitor Cam", FR: "Babyphone WiFi", DE: "Babyphone WLAN", US: "Baby monitor WiFi" }, 79, "eu_latin", { tags: ["amazon_best"], arbitragePotential: 86, extraAffinity: { US: 0.85, DE: 0.9 } }),
  item("baby-bottle-warmer", "baby", { EN: "Portable Bottle Warmer", FR: "Chauffe-biberon portable", DE: "Flaschenwärmer", US: "Travel bottle warmer" }, 35, "eu_latin", { tags: ["evergreen"], arbitragePotential: 83 }),
  item("baby-white-noise", "baby", { EN: "White Noise Sleep Machine", US: "White noise machine", FR: "Machine bruit blanc", DE: "White Noise Gerät" }, 28, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 85, extraAffinity: { FR: 0.7, DE: 0.75 } }),
  item("baby-stroller-organizer", "baby", { EN: "Stroller Organizer Bag", FR: "Organiseur poussette", DE: "Kinderwagen Organizer", US: "Stroller caddy" }, 18, "eu_latin", { tags: ["evergreen"], arbitragePotential: 78 }),
  item("baby-teething-toys", "baby", { EN: "Silicone Teething Set", FR: "Jouets dentition silicone", US: "Teething toys set", DE: "Beißring Set" }, 14, "global", { tags: ["evergreen"], arbitragePotential: 76 }),
  item("baby-car-seat-mirror", "baby", { EN: "Baby Car Seat Mirror", US: "Rear facing mirror", FR: "Miroir siège bébé", DE: "Babyspiegel Auto" }, 16, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 80, extraAffinity: { DE: 0.8, FR: 0.75 } }),
  item("baby-diaper-bag", "baby", { EN: "Convertible Diaper Backpack", FR: "Sac à langer convertible", US: "Diaper backpack", DE: "Wickelrucksack" }, 45, "eu_latin", { tags: ["amazon_best"], arbitragePotential: 82 }),
  item("baby-bath-thermometer", "baby", { EN: "Floating Bath Thermometer", FR: "Thermomètre bain", DE: "Badethermometer", US: "Bath thermometer" }, 11, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 77, extraAffinity: { FR: 0.8 } }),
  item("baby-night-light", "baby", { EN: "Soft Animal Night Light", FR: "Veilleuse animal douce", JP: "やわらかナイトライト", US: "Nursery night light" }, 19, "global", { tags: ["tiktok_viral"], arbitragePotential: 81 }),
  item("baby-sterilizer", "baby", { EN: "UV Bottle Sterilizer", FR: "Stérilisateur UV", DE: "UV Sterilisator", KR: "UV 젖병소독기" }, 59, "asia_east", { tags: ["amazon_best"], arbitragePotential: 87, extraAffinity: { FR: 0.75, DE: 0.8 } }),

  // ── fitness (10)
  item("fitness-walking-pad", "fitness", { EN: "Under Desk Walking Pad", US: "Walking pad under desk", FR: "Tapis de marche bureau", DE: "Walking Pad", AU: "Walking pad" }, 189, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 92, extraAffinity: { DE: 0.75, FR: 0.7 } }),
  item("fitness-resistance-bands", "fitness", { EN: "Resistance Bands Set 5", US: "Resistance bands", DE: "Fitnessbänder", FR: "Élastiques fitness", AU: "Resistance bands" }, 16, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 80 }),
  item("fitness-yoga-mat", "fitness", { EN: "Non-Slip Yoga Mat 6mm", DE: "Yogamatte rutschfest", FR: "Tapis yoga antidérapant", US: "Yoga mat non-slip", SE: "Yogamatta" }, 24, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 78, extraAffinity: { US: 0.75 } }),
  item("fitness-foam-roller", "fitness", { EN: "Vibrating Foam Roller", US: "Vibrating foam roller", DE: "Faszienrolle vibrierend", AU: "Foam roller vibe" }, 49, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 84 }),
  item("fitness-jump-rope", "fitness", { EN: "Smart Jump Rope Counter", US: "Smart jump rope", FR: "Corde à sauter compteur", CN: "智能跳绳" }, 18, "global", { tags: ["tiktok_viral"], arbitragePotential: 81 }),
  item("fitness-ab-wheel", "fitness", { EN: "Ab Roller Wheel Pro", US: "Ab wheel", DE: "Bauchroller", FR: "Roue abdos" }, 15, "global", { tags: ["evergreen"], arbitragePotential: 75 }),
  item("fitness-massage-gun", "fitness", { EN: "Percussion Massage Gun", US: "Massage gun", DE: "Massagepistole", FR: "Pistolet de massage", AU: "Massage gun" }, 55, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 86 }),
  item("fitness-ankle-weights", "fitness", { EN: "Adjustable Ankle Weights", US: "Ankle weights", BR: "Caneleira", FR: "Lest chevilles" }, 22, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 79, extraAffinity: { BR: 0.75 } }),
  item("fitness-pullup-bar", "fitness", { EN: "Doorway Pull-Up Bar", US: "Pull up bar door", DE: "Türreck", FR: "Barre de traction porte" }, 28, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 77 }),
  item("fitness-heart-band", "fitness", { EN: "Optical Heart Rate Band", US: "HR fitness band", DE: "Pulsuhr Armband", JP: "心拍バンド" }, 33, "global", { tags: ["evergreen"], arbitragePotential: 82 }),

  // ── kitchen_gadget (10)
  item("kitchen-airfryer", "kitchen_gadget", { EN: "Air Fryer 5L Digital", FR: "Airfryer 5L", DE: "Heißluftfritteuse 5L", UK: "Air fryer 5L", US: "Air fryer 5QT" }, 79, "eu_latin", { tags: ["amazon_best", "tiktok_viral"], arbitragePotential: 88, extraAffinity: { US: 0.85, UK: 0.9, DE: 0.9 } }),
  item("kitchen-blender-usb", "kitchen_gadget", { EN: "Portable USB Blender", US: "Portable blender USB-C", FR: "Blender portable USB", BR: "Mixer portátil" }, 27, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 85 }),
  item("kitchen-egg-cooker", "kitchen_gadget", { EN: "Electric Egg Cooker", DE: "Eierkocher", US: "Egg cooker", FR: "Cuiseur œufs" }, 22, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 76 }),
  item("kitchen-mandoline", "kitchen_gadget", { EN: "Safe Mandoline Slicer", FR: "Mandoline sécurisée", DE: "Gemüsehobel", IT: "Mandolina" }, 25, "eu_latin", { tags: ["evergreen"], arbitragePotential: 78 }),
  item("kitchen-milk-frother", "kitchen_gadget", { EN: "Electric Milk Frother", FR: "Mousseur à lait", DE: "Milchaufschäumer", US: "Milk frother" }, 18, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 77, extraAffinity: { FR: 0.8 } }),
  item("kitchen-spice-rack", "kitchen_gadget", { EN: "Rotating Spice Rack", US: "Lazy susan spice", FR: "Carrousel épices", DE: "Gewürzkarussell" }, 31, "global", { tags: ["amazon_best"], arbitragePotential: 79 }),
  item("kitchen-vacuum-sealer", "kitchen_gadget", { EN: "Food Vacuum Sealer", DE: "Vakuumierer", US: "Vacuum sealer", FR: "Machine sous vide" }, 48, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 83 }),
  item("kitchen-rice-cooker-mini", "kitchen_gadget", { EN: "Mini Rice Cooker 1.2L", JP: "ミニ炊飯器", KR: "미니밥솥", VN: "Nồi cơm mini", US: "Mini rice cooker" }, 35, "asia_east", { tags: ["amazon_best"], arbitragePotential: 84, extraAffinity: { VN: 0.85, ID: 0.8 } }),
  item("kitchen-garlic-press", "kitchen_gadget", { EN: "Stainless Garlic Press", FR: "Presse-ail inox", DE: "Knoblauchpresse", UK: "Garlic press" }, 12, "eu_latin", { tags: ["evergreen"], arbitragePotential: 74 }),
  item("kitchen-coffee-grinder", "kitchen_gadget", { EN: "Burr Coffee Grinder", DE: "Kaffeemühle", US: "Burr grinder", FR: "Moulin à café" }, 55, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 81, extraAffinity: { US: 0.8 } }),

  // ── phone_accessories (10)
  item("phone-magsafe-case", "phone_accessories", { EN: "Clear MagSafe Case", FR: "Coque MagSafe transparente", US: "MagSafe clear case", JP: "MagSafeクリアケース", DE: "MagSafe Hülle" }, 14, "global", { tags: ["amazon_best", "tiktok_viral"], arbitragePotential: 86 }),
  item("phone-charger-gan", "phone_accessories", { EN: "GaN 65W Charger", US: "GaN charger 65W", FR: "Chargeur GaN 65W", CN: "氮化镓65W", JP: "GaN充電器65W" }, 29, "global", { tags: ["amazon_best"], arbitragePotential: 84 }),
  item("phone-ring-holder", "phone_accessories", { EN: "MagSafe Ring Stand", FR: "Anneau MagSafe", US: "MagSafe ring", IN: "Phone ring stand" }, 9, "sea", { tags: ["evergreen"], arbitragePotential: 80, extraAffinity: { US: 0.7, FR: 0.65 } }),
  item("phone-tempered-glass", "phone_accessories", { EN: "Privacy Tempered Glass", FR: "Verre privacy", US: "Privacy screen glass", IN: "Privacy glass", ID: "Tempered privacy" }, 11, "sea", { tags: ["amazon_best"], arbitragePotential: 82 }),
  item("phone-cable-braided", "phone_accessories", { EN: "Braided USB-C Cable 2m", US: "Braided USB-C 6ft", FR: "Câble USB-C tressé 2m", CN: "编织线2米" }, 8, "global", { tags: ["evergreen"], arbitragePotential: 75 }),
  item("phone-car-charger", "phone_accessories", { EN: "Dual PD Car Charger", US: "PD car charger", AE: "Car PD charger", DE: "Auto Ladegerät PD" }, 16, "global", { tags: ["amazon_best"], arbitragePotential: 78 }),
  item("phone-selfie-stick", "phone_accessories", { EN: "Tripod Selfie Stick LED", BR: "Tripé selfie LED", US: "Selfie stick tripod", VN: "Gậy selfie tripod" }, 19, "latam", { tags: ["tiktok_viral"], arbitragePotential: 83, extraAffinity: { VN: 0.8, US: 0.7 } }),
  item("phone-wallet-case", "phone_accessories", { EN: "Folio Wallet Phone Case", FR: "Étui portefeuille", DE: "Handyhülle Wallet", US: "Wallet case" }, 17, "eu_latin", { tags: ["evergreen"], arbitragePotential: 76 }),
  item("phone-dust-plug", "phone_accessories", { EN: "Port Dust Plug Set Cute", JP: "コネクタキャップ", KR: "먼지마개", CN: "防尘塞" }, 5, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 79 }),
  item("phone-power-bank-solar", "phone_accessories", { EN: "Solar Power Bank 20k", ZA: "Solar power bank", NG: "Solar bank 20000", US: "Solar power bank", AU: "Solar bank" }, 32, "us_anglo", { tags: ["evergreen"], arbitragePotential: 85, extraAffinity: { ZA: 0.9, NG: 0.88 } }),

  // ── wellness (10)
  item("wellness-neck-massager", "wellness", { EN: "Heated Neck Massager", US: "Neck massager heated", FR: "Massage cou chauffant", DE: "Nackenmassagegerät" }, 34, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 85 }),
  item("wellness-eye-mask", "wellness", { EN: "Heated Eye Mask USB", JP: "ホットアイマスク", KR: "온열 안대", US: "Heated eye mask", FR: "Masque yeux chauffant" }, 21, "asia_east", { tags: ["tiktok_viral"], arbitragePotential: 87 }),
  item("wellness-diffuser", "wellness", { EN: "Essential Oil Diffuser", FR: "Diffuseur huiles", US: "Oil diffuser", DE: "Aroma Diffuser" }, 28, "eu_latin", { tags: ["evergreen"], arbitragePotential: 80 }),
  item("wellness-posture-corrector", "wellness", { EN: "Posture Corrector Brace", US: "Posture corrector", FR: "Correcteur de posture", DE: "Haltungskorrektor" }, 19, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 84 }),
  item("wellness-sleep-earbuds", "wellness", { EN: "Sleep Earbuds Soft", US: "Sleep earbuds", JP: "睡眠イヤホン", FR: "Écouteurs sommeil" }, 39, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 86, extraAffinity: { JP: 0.75 } }),
  item("wellness-foot-spa", "wellness", { EN: "Foot Spa Massager", DE: "Fußsprudelbad", US: "Foot spa", FR: "Spa pieds" }, 55, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 79 }),
  item("wellness-red-light", "wellness", { EN: "Red Light Therapy Panel Mini", US: "Red light panel", AU: "Red light therapy", FR: "Panneau lumière rouge" }, 69, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 89 }),
  item("wellness-acupressure-mat", "wellness", { EN: "Acupressure Mat Pillow Set", DE: "Akupressurmatte", US: "Acupressure mat", SE: "Spikmatta" }, 32, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 81 }),
  item("wellness-water-floss", "wellness", { EN: "Cordless Water Flosser", US: "Water flosser", JP: "口腔洗浄器", KR: "워터픽", FR: "Jet dentaire" }, 36, "asia_east", { tags: ["amazon_best"], arbitragePotential: 85, extraAffinity: { US: 0.8 } }),
  item("wellness-weighted-blanket", "wellness", { EN: "Weighted Blanket 7kg", US: "Weighted blanket", DE: "Gewichtsdecke", UK: "Weighted blanket", AU: "Weighted blanket" }, 59, "us_anglo", { tags: ["evergreen"], seasonality: [10, 11, 12, 1, 2], arbitragePotential: 83 }),

  // ── party_deco (10)
  item("party-balloon-arch", "party_deco", { EN: "Balloon Arch Stand Kit", BR: "Kit arco de balões", MX: "Arco de globos", US: "Balloon arch kit", CO: "Arco globos" }, 34, "latam", { tags: ["tiktok_viral"], seasonality: [11, 12, 1, 2, 5, 6], arbitragePotential: 88 }),
  item("party-number-lights", "party_deco", { EN: "LED Number Lights 1m", US: "Marquee number lights", FR: "Chiffres lumineux LED", BR: "Números LED" }, 26, "latam", { tags: ["tiktok_viral"], arbitragePotential: 84, extraAffinity: { US: 0.75, FR: 0.7 } }),
  item("party-confetti-cannon", "party_deco", { EN: "Confetti Party Cannon", MX: "Cañón confeti", BR: "Canhão confete", US: "Confetti cannon", ES: "Cañón confeti" }, 12, "latam", { tags: ["tiktok_viral"], arbitragePotential: 82 }),
  item("party-backdrop-stand", "party_deco", { EN: "Photo Backdrop Stand", US: "Backdrop stand", BR: "Suporte backdrop", FR: "Support fond photo" }, 38, "latam", { tags: ["amazon_best"], arbitragePotential: 80 }),
  item("party-smoke-fog", "party_deco", { EN: "Mini Fog Machine Party", US: "Fog machine mini", BR: "Máquina de fumaça", MX: "Máquina humo" }, 45, "latam", { tags: ["tiktok_viral"], arbitragePotential: 83 }),
  item("party-tableware-gold", "party_deco", { EN: "Gold Disposable Tableware", FR: "Vaisselle jetable or", US: "Gold party plates", ES: "Vajilla dorada" }, 15, "eu_latin", { tags: ["evergreen"], arbitragePotential: 76 }),
  item("party-projector-stars", "party_deco", { EN: "Galaxy Star Projector", US: "Star projector", FR: "Projecteur galaxie", BR: "Projetor galaxia" }, 29, "global", { tags: ["tiktok_viral"], arbitragePotential: 85 }),
  item("party-piñata-kit", "party_deco", { EN: "DIY Piñata Kit", MX: "Kit piñata DIY", US: "Piñata kit", ES: "Kit piñata", CO: "Piñata kit" }, 18, "latam", { tags: ["evergreen"], arbitragePotential: 81 }),
  item("party-cake-topper-led", "party_deco", { EN: "LED Cake Topper Set", BR: "Topper bolo LED", US: "LED cake topper", FR: "Cake topper LED" }, 11, "latam", { tags: ["tiktok_viral"], arbitragePotential: 79 }),
  item("party-neon-sign-custom", "party_deco", { EN: "Custom Neon Name Sign", US: "Custom neon sign", FR: "Néon prénom custom", BR: "Neon nome" }, 49, "us_anglo", { tags: ["tiktok_viral"], arbitragePotential: 87, extraAffinity: { BR: 0.7, FR: 0.65 } }),

  // ── eco_home (10)
  item("eco-bamboo-cutlery", "eco_home", { EN: "Bamboo Travel Cutlery", DE: "Bambus Besteck", NL: "Bamboe bestek", SE: "Bambubestick", FR: "Couverts bambou" }, 12, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 80 }),
  item("eco-bee-wraps", "eco_home", { EN: "Beeswax Food Wraps", DE: "Bienenwachstücher", SE: "Bivaxdukar", NL: "Bijenwasdoek", FR: "Emballages cire d'abeille" }, 16, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 82 }),
  item("eco-compost-bin", "eco_home", { EN: "Countertop Compost Bin", DE: "Komposteimer", NL: "Compostbak", SE: "Komposthink", US: "Compost bin" }, 28, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 81, extraAffinity: { US: 0.7 } }),
  item("eco-reusable-bags", "eco_home", { EN: "Mesh Produce Bags 9pk", DE: "Obstnetzbeutel", FR: "Filets fruits réutilisables", NL: "Groentenetten" }, 11, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 77 }),
  item("eco-laundry-balls", "eco_home", { EN: "Wool Dryer Balls 6pk", DE: "Trocknerbälle Wolle", US: "Wool dryer balls", SE: "Torkbollar" }, 14, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 79, extraAffinity: { US: 0.75 } }),
  item("eco-water-filter", "eco_home", { EN: "Pitcher Water Filter", DE: "Wasserfilterkanne", FR: "Carafe filtrante", NL: "Waterfilterkan" }, 32, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 78 }),
  item("eco-solar-garden", "eco_home", { EN: "Solar Garden Path Lights", DE: "Solar Wegeleuchten", NL: "Solar tuinverlichting", US: "Solar path lights" }, 24, "eu_nordic", { tags: ["summer"], seasonality: [4, 5, 6, 7, 8], arbitragePotential: 80 }),
  item("eco-bamboo-toothbrush", "eco_home", { EN: "Bamboo Toothbrush Pack", DE: "Bambuszahnbürste", FR: "Brosse à dents bambou", SE: "Bambutandborste" }, 9, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 75 }),
  item("eco-glass-straws", "eco_home", { EN: "Glass Straw Set Brush", DE: "Glasstrohhalme", NL: "Glazen rietjes", FR: "Pailles en verre" }, 13, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 76 }),
  item("eco-bike-repair", "eco_home", { EN: "Bike Repair Multi Tool", DE: "Fahrrad Multitool", NL: "Fiets multitool", SE: "Cykelverktyg", FR: "Outil multi vélo" }, 17, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 81 }),

  // ── office (10)
  item("office-laptop-stand", "office", { EN: "Aluminum Laptop Stand", US: "Laptop stand alum", DE: "Laptopständer", FR: "Support laptop alu", JP: "ノートPCスタンド" }, 35, "global", { tags: ["amazon_best"], arbitragePotential: 83 }),
  item("office-monitor-arm", "office", { EN: "Single Monitor Arm Gas", DE: "Monitorarm", US: "Monitor arm", NL: "Monitorarm", SE: "Monitorarm" }, 55, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 82, extraAffinity: { US: 0.8 } }),
  item("office-desk-mat", "office", { EN: "Extended Desk Mat XXL", US: "Desk mat XXL", JP: "デスクマット特大", DE: "Schreibtischunterlage" }, 22, "global", { tags: ["tiktok_viral"], arbitragePotential: 81 }),
  item("office-webcam", "office", { EN: "1080p Autofocus Webcam", US: "Webcam 1080p AF", DE: "Webcam 1080p", FR: "Webcam autofocus" }, 42, "us_anglo", { tags: ["amazon_best"], arbitragePotential: 80 }),
  item("office-cable-mgmt", "office", { EN: "Cable Management Box", DE: "Kabelbox", NL: "Kabelbox", FR: "Boîte range-câbles", SE: "Kabelbox" }, 16, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 77 }),
  item("office-footrest", "office", { EN: "Ergonomic Foot Rest", DE: "Fußstütze", US: "Foot rest under desk", NL: "Voetensteun" }, 27, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 78 }),
  item("office-doc-scanner", "office", { EN: "Portable Document Scanner", US: "Doc scanner portable", DE: "Dokumentenscanner", JP: "ドキュメントスキャナ" }, 89, "global", { tags: ["amazon_best"], arbitragePotential: 84 }),
  item("office-noise-cancelling", "office", { EN: "Office ANC Headphones", DE: "Büro ANC Kopfhörer", US: "ANC office headset", SE: "ANC hörlurar" }, 79, "eu_nordic", { tags: ["amazon_best"], arbitragePotential: 85, extraAffinity: { US: 0.8 } }),
  item("office-whiteboard-film", "office", { EN: "Whiteboard Wall Film", DE: "Whiteboardfolie", US: "Whiteboard wallpaper", NL: "Whiteboard folie" }, 31, "eu_nordic", { tags: ["evergreen"], arbitragePotential: 79 }),
  item("office-label-maker", "office", { EN: "Bluetooth Label Maker", US: "Label maker BT", DE: "Beschriftungsgerät", FR: "Étiqueteuse Bluetooth", JP: "ラベルライター" }, 38, "global", { tags: ["amazon_best"], arbitragePotential: 82 }),
]

if (PRODUCT_POOL.length !== 150) {
  console.warn("[product-pools]", {
    result: "count_mismatch",
    expected: 150,
    actual: PRODUCT_POOL.length,
  })
}

export function resolveProductTitle(product: ProductArchetype, countryCode: string): string {
  const code = countryCode.toUpperCase()
  const t = product.title
  if (code === "US" && t.US) return t.US
  if (code === "UK" && t.UK) return t.UK
  const keyed = t[code as keyof LocalizedTitle]
  if (typeof keyed === "string" && keyed.length > 0) return keyed
  if (code === "CA" || code === "AU" || code === "NZ") return t.US ?? t.EN
  if (["BE", "CH", "LU"].includes(code)) return t.FR ?? t.EN
  return t.EN
}

export function getProductsByCategories(categories: string[]): ProductArchetype[] {
  if (categories.length === 0) return PRODUCT_POOL
  const set = new Set(categories)
  const matched = PRODUCT_POOL.filter((p) => set.has(p.category))
  return matched.length >= 20 ? matched : PRODUCT_POOL
}
