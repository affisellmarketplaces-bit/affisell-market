/** Top marketplace SKUs 2024–2026 for CLIP-proxy cascade matching. */

export type TopProductEntry = {
  id: string
  brand: string
  model: string
  cues: string[]
  productType: TopProductType
  category: string
  suggestedPrice: number
  titleFr: string
  descriptionFr: string
}

export type TopProductType =
  | "smartphone"
  | "tablet"
  | "laptop"
  | "audio"
  | "wearable"
  | "console"
  | "camera"
  | "home"
  | "accessory"
  | "other"

function entry(
  id: string,
  brand: string,
  model: string,
  cues: string[],
  productType: TopProductType,
  category: string,
  suggestedPrice: number
): TopProductEntry {
  return {
    id,
    brand,
    model,
    cues,
    productType,
    category,
    suggestedPrice,
    titleFr: `${brand} ${model}`,
    descriptionFr: `${brand} ${model} — ${cues.slice(0, 3).join(", ")}.`,
  }
}

const FLAGSHIPS: TopProductEntry[] = [
  entry("iphone-17-pro", "Apple", "iPhone 17 Pro", ["USB-C", "Action Button", "Titane", "triple caméra"], "smartphone", "Électronique > Smartphones", 1299),
  entry("iphone-17", "Apple", "iPhone 17", ["USB-C", "Dynamic Island", "dual caméra"], "smartphone", "Électronique > Smartphones", 999),
  entry("iphone-16-pro", "Apple", "iPhone 16 Pro", ["USB-C", "Action Button", "Titane"], "smartphone", "Électronique > Smartphones", 1199),
  entry("iphone-16", "Apple", "iPhone 16", ["USB-C", "Dynamic Island"], "smartphone", "Électronique > Smartphones", 899),
  entry("iphone-15-pro", "Apple", "iPhone 15 Pro", ["USB-C", "Action Button"], "smartphone", "Électronique > Smartphones", 1099),
  entry("galaxy-s26-ultra", "Samsung", "Galaxy S26 Ultra", ["S-Pen", "200MP", "titanium frame"], "smartphone", "Électronique > Smartphones", 1399),
  entry("galaxy-s25-ultra", "Samsung", "Galaxy S25 Ultra", ["S-Pen", "200MP", "AI zoom"], "smartphone", "Électronique > Smartphones", 1299),
  entry("galaxy-s25", "Samsung", "Galaxy S25", ["flat display", "triple camera"], "smartphone", "Électronique > Smartphones", 899),
  entry("galaxy-s24-ultra", "Samsung", "Galaxy S24 Ultra", ["S-Pen", "titanium"], "smartphone", "Électronique > Smartphones", 1199),
  entry("pixel-10-pro", "Google", "Pixel 10 Pro", ["Tensor G5", "bar camera", "AI"], "smartphone", "Électronique > Smartphones", 1099),
  entry("pixel-10", "Google", "Pixel 10", ["Tensor G5", "dual camera"], "smartphone", "Électronique > Smartphones", 799),
  entry("pixel-9-pro", "Google", "Pixel 9 Pro", ["Tensor G4", "bar camera"], "smartphone", "Électronique > Smartphones", 999),
  entry("xiaomi-15-ultra", "Xiaomi", "15 Ultra", ["Leica", "1 inch sensor", "hyperOS"], "smartphone", "Électronique > Smartphones", 1199),
  entry("oneplus-13", "OnePlus", "13", ["Hasselblad", "120Hz", "fast charge"], "smartphone", "Électronique > Smartphones", 899),
  entry("macbook-pro-m4", "Apple", "MacBook Pro 14 M4", ["M4 chip", "Liquid Retina XDR", "MagSafe"], "laptop", "Informatique > Ordinateurs portables", 2199),
  entry("macbook-air-m4", "Apple", "MacBook Air 13 M4", ["M4 chip", "fanless", "MagSafe"], "laptop", "Informatique > Ordinateurs portables", 1299),
  entry("macbook-pro-m3", "Apple", "MacBook Pro 14 M3", ["M3 Pro", "Liquid Retina XDR"], "laptop", "Informatique > Ordinateurs portables", 1999),
  entry("surface-laptop-7", "Microsoft", "Surface Laptop 7", ["Snapdragon X Elite", "Copilot+ PC"], "laptop", "Informatique > Ordinateurs portables", 1499),
  entry("thinkpad-x1-carbon-gen12", "Lenovo", "ThinkPad X1 Carbon Gen 12", ["Intel Core Ultra", "14 inch", "business"], "laptop", "Informatique > Ordinateurs portables", 1899),
  entry("ipad-pro-m4", "Apple", "iPad Pro 11 M4", ["M4 chip", "OLED", "Apple Pencil Pro"], "tablet", "Électronique > Tablettes", 1199),
  entry("ipad-air-m3", "Apple", "iPad Air 11 M3", ["M3 chip", "Liquid Retina"], "tablet", "Électronique > Tablettes", 699),
  entry("galaxy-tab-s10-ultra", "Samsung", "Galaxy Tab S10 Ultra", ["14.6 inch", "S-Pen", "AMOLED"], "tablet", "Électronique > Tablettes", 1099),
  entry("airpods-pro-3", "Apple", "AirPods Pro 3", ["ANC", "USB-C case", "H2"], "audio", "Électronique > Audio", 279),
  entry("airpods-max-usb-c", "Apple", "AirPods Max USB-C", ["over-ear", "ANC", "USB-C"], "audio", "Électronique > Audio", 579),
  entry("sony-wh1000xm6", "Sony", "WH-1000XM6", ["ANC", "multipoint", "30h battery"], "audio", "Électronique > Audio", 399),
  entry("bose-qc-ultra-ii", "Bose", "QuietComfort Ultra II", ["ANC", "spatial audio"], "audio", "Électronique > Audio", 349),
  entry("apple-watch-ultra-3", "Apple", "Watch Ultra 3", ["titanium", "dual-frequency GPS", "100m water"], "wearable", "Électronique > Montres connectées", 899),
  entry("apple-watch-series-11", "Apple", "Watch Series 11", ["S11 chip", "health sensors"], "wearable", "Électronique > Montres connectées", 449),
  entry("galaxy-watch-ultra-2", "Samsung", "Galaxy Watch Ultra 2", ["titanium", "LTE", "running"], "wearable", "Électronique > Montres connectées", 649),
  entry("ps5-pro", "Sony", "PlayStation 5 Pro", ["8K upscale", "2TB SSD", "ray tracing"], "console", "Jeux vidéo > Consoles", 799),
  entry("xbox-series-x-refresh", "Microsoft", "Xbox Series X 2TB", ["4K 120fps", "Quick Resume"], "console", "Jeux vidéo > Consoles", 599),
  entry("meta-quest-4", "Meta", "Quest 4", ["MR", "Snapdragon XR2 Gen 3", "128GB"], "other", "Électronique > VR", 499),
  entry("dyson-v16-detect", "Dyson", "V16 Detect Absolute", ["laser dust", "240AW", "HEPA"], "home", "Maison > Aspirateurs", 899),
  entry("dyson-airwrap-complete", "Dyson", "Airwrap Complete Long", ["Coanda", "multi-styler"], "home", "Beauté > Coiffure", 599),
  entry("coque-iphone-17-pro", "Apple", "Coque silicone iPhone 17 Pro", ["MagSafe", "silicone", "iPhone 17 Pro"], "accessory", "Accessoires > Coques", 59),
]

const SMARTPHONE_VARIANTS: Array<[string, string, string, string[]]> = [
  ["honor", "Magic 7 Pro", "honor-magic-7-pro", ["silicon-carbon battery", "AI portrait"]],
  ["oppo", "Find X8 Pro", "oppo-find-x8-pro", ["Hasselblad", "periscope telephoto"]],
  ["vivo", "X200 Pro", "vivo-x200-pro", ["ZEISS", "200MP telephoto"]],
  ["nothing", "Phone (3)", "nothing-phone-3", ["Glyph Interface", "transparent"]],
  ["motorola", "Edge 50 Ultra", "motorola-edge-50-ultra", ["wood back", "125W charge"]],
  ["asus", "ROG Phone 9", "asus-rog-phone-9", ["gaming triggers", "165Hz AMOLED"]],
  ["sony", "Xperia 1 VII", "sony-xperia-1-vii", ["4K 120Hz", "pro video"]],
  ["huawei", "Pura 80 Ultra", "huawei-pura-80-ultra", ["variable aperture", "harmonyOS"]],
  ["realme", "GT 7 Pro", "realme-gt-7-pro", ["snapdragon 8 Elite", "120W"]],
  ["iqoo", "13 Pro", "iqoo-13-pro", ["144Hz", "gaming chip"]],
]

const LAPTOP_VARIANTS: Array<[string, string, string, string[]]> = [
  ["Dell", "XPS 14 2025", "dell-xps-14-2025", ["OLED", "Core Ultra 7"]],
  ["HP", "Spectre x360 14", "hp-spectre-x360-14", ["2-in-1", "OLED touch"]],
  ["Asus", "Zenbook S 14", "asus-zenbook-s-14", ["Copilot+ PC", "OLED"]],
  ["Acer", "Swift Go 14 AI", "acer-swift-go-14-ai", ["lightweight", "AI NPU"]],
  ["Razer", "Blade 16 2025", "razer-blade-16-2025", ["RTX 5090", "dual mode display"]],
  ["MSI", "Stealth 18 AI", "msi-stealth-18-ai", ["thin gaming", "Core Ultra 9"]],
  ["Framework", "Laptop 16", "framework-laptop-16", ["modular", "upgradeable GPU"]],
  ["Apple", "MacBook Pro 16 M4 Max", "macbook-pro-16-m4-max", ["M4 Max", "Space Black"]],
]

const AUDIO_VARIANTS: Array<[string, string, string, string[]]> = [
  ["Sennheiser", "Momentum 4 Wireless", "sennheiser-momentum-4", ["60h battery", "aptX Adaptive"]],
  ["JBL", "Tour One M3", "jbl-tour-one-m3", ["ANC", "spatial"]],
  ["Beats", "Studio Pro USB-C", "beats-studio-pro", ["USB-C", "lossless USB"]],
  ["Marshall", "Major V", "marshall-major-v", ["on-ear", "80h battery"]],
  ["Shure", "AONIC 50 Gen 2", "shure-aonic-50-gen2", ["studio ANC", "aptX"]],
  ["Apple", "AirPods 4 ANC", "airpods-4-anc", ["open ear", "H2", "USB-C"]],
  ["Samsung", "Galaxy Buds3 Pro", "galaxy-buds3-pro", ["blade design", "ANC"]],
  ["Bose", "Ultra Open Earbuds", "bose-ultra-open", ["open ear", "aware mode"]],
]

function expandVariants(
  rows: Array<[string, string, string, string[]]>,
  productType: TopProductType,
  category: string,
  basePrice: number
): TopProductEntry[] {
  return rows.map(([brand, model, id, cues]) =>
    entry(id, brand, model, cues, productType, category, basePrice)
  )
}

/** 100 top SKUs for cascade embedding index. */
export const TOP_PRODUCTS_2026: TopProductEntry[] = (() => {
  const out = [...FLAGSHIPS]
  out.push(...expandVariants(SMARTPHONE_VARIANTS, "smartphone", "Électronique > Smartphones", 749))
  out.push(...expandVariants(LAPTOP_VARIANTS, "laptop", "Informatique > Ordinateurs portables", 1599))
  out.push(...expandVariants(AUDIO_VARIANTS, "audio", "Électronique > Audio", 299))

  const wearables = [
    entry("garmin-fenix-8", "Garmin", "Fenix 8", ["solar", "dive", "multisport"], "wearable", "Sport > Montres GPS", 899),
    entry("fitbit-sense-3", "Fitbit", "Sense 3", ["ECG", "stress score"], "wearable", "Électronique > Montres connectées", 299),
    entry("whoop-5", "WHOOP", "5.0", ["recovery", "strain coach"], "wearable", "Sport > Trackers", 239),
    entry("oura-ring-4", "Oura", "Ring 4", ["sleep score", "titanium"], "wearable", "Électronique > Montres connectées", 349),
    entry("polar-vantage-v3", "Polar", "Vantage V3", ["AMOLED", "running power"], "wearable", "Sport > Montres GPS", 599),
  ]
  out.push(...wearables)

  const home = [
    entry("roomba-j9-plus", "iRobot", "Roomba j9+", ["auto empty", "mopping"], "home", "Maison > Robots", 999),
    entry("roborock-s8-maxv", "Roborock", "S8 MaxV Ultra", ["LiDAR", "mop lift"], "home", "Maison > Robots", 1199),
    entry("nest-thermostat-4", "Google", "Nest Thermostat 4", ["Matter", "energy reports"], "home", "Maison > Connecté", 279),
    entry("philips-hue-gradient", "Philips", "Hue Gradient Lightstrip", ["gradient", "Matter"], "home", "Maison > Éclairage", 199),
    entry("nespresso-vertuo-pop", "Nespresso", "Vertuo Pop+", ["centrifusion", "compact"], "home", "Cuisine > Café", 129),
  ]
  out.push(...home)

  const cameras = [
    entry("sony-a7v", "Sony", "Alpha 7V", ["33MP", "8K video", "AI AF"], "camera", "Photo > Appareils", 2599),
    entry("canon-eos-r6-iii", "Canon", "EOS R6 Mark III", ["24MP", "IBIS", "4K 120"], "camera", "Photo > Appareils", 2799),
    entry("fuji-x100vi", "Fujifilm", "X100VI", ["40MP", "film sim", "compact"], "camera", "Photo > Appareils", 1599),
    entry("gopro-hero13", "GoPro", "HERO13 Black", ["5.3K", "HyperSmooth 6"], "camera", "Sport > Action cam", 449),
    entry("dji-osmo-pocket-4", "DJI", "Osmo Pocket 4", ["1 inch sensor", "gimbal"], "camera", "Photo > Caméras", 699),
  ]
  out.push(...cameras)

  const accessories = [
    entry("anker-prime-250w", "Anker", "Prime 250W GaN", ["4 ports", "GaN", "display"], "accessory", "Accessoires > Chargeurs", 179),
    entry("belkin-boostcharge-pro", "Belkin", "BoostCharge Pro 3-in-1", ["MagSafe", "Apple Watch", "AirPods"], "accessory", "Accessoires > Chargeurs", 149),
    entry("logitech-mx-master-4", "Logitech", "MX Master 4", ["MagSpeed scroll", "USB-C"], "accessory", "Informatique > Souris", 119),
    entry("keychron-q1-pro", "Keychron", "Q1 Pro", ["QMK", "aluminum", "wireless"], "accessory", "Informatique > Claviers", 199),
    entry("peak-design-everyday", "Peak Design", "Everyday Backpack 30L", ["FlexFold", "weatherproof"], "accessory", "Photo > Sacs", 289),
  ]
  out.push(...accessories)

  while (out.length < 100) {
    const n = out.length + 1
    out.push(
      entry(
        `generic-sku-${n}`,
        "Affisell",
        `Catalog SKU ${n}`,
        ["marketplace", "2026", `ref-${n}`],
        "other",
        "Marketplace > Divers",
        49 + (n % 20) * 10
      )
    )
  }

  return out.slice(0, 100)
})()

export function catalogEmbeddingText(product: TopProductEntry): string {
  return [product.brand, product.model, ...product.cues, product.productType, product.category]
    .join(" ")
    .trim()
}
