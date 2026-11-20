import type { BenchCase } from "@/lib/ai/bench/instantscan-bench"

/**
 * SYNTHETIC labelled cases for the InstantScan catalog-match bench — written by hand, for TESTS ONLY.
 *
 * There is no photo and no real vision model behind them: each case carries the JSON text a vision model WOULD plausibly
 * write (`modelAnswer`) and the entry it should lead to (`truth`, an id of lib/ai/curated-product-catalog.ts, or `null` when
 * the product is deliberately not in the catalog). The 'model' is a script (`createSimulatedVisionModel`) that replays that
 * text after a scripted delay.
 *
 * Therefore: any number computed from this file measures the LEXICAL MATCHER on invented text. It is not the accuracy of
 * InstantScan on real photos and must never be quoted as such (see docs/AI-HONESTY-AND-MEASUREMENT.md for the real method).
 * Every case is flagged `synthetic: true`; the bench labels its report accordingly.
 */

export type SyntheticInput = {
  /** The raw JSON a (simulated) vision model returned. */
  modelAnswer: string
  /** Scripted latency of the simulated model, in ms. */
  simulatedLatencyMs: number
}

function answer(brand: string | null, model: string | null, cues: string[], productType: string): string {
  return JSON.stringify({ brand, model, visualCues: cues, productType })
}

function c(
  id: string,
  truth: string | null,
  modelAnswer: string,
  simulatedLatencyMs: number
): BenchCase<SyntheticInput> {
  return { id, truth, input: { modelAnswer, simulatedLatencyMs }, synthetic: true }
}

export const SYNTHETIC_BENCH_CASES: BenchCase<SyntheticInput>[] = [
  // --- in the catalog, the model reads brand + model + features (easy) ---------------------------------------------
  c("iphone-17-pro/clean", "iphone-17-pro", answer("Apple", "iPhone 17 Pro", ["USB-C", "Action Button", "Titane", "triple caméra"], "smartphone"), 620),
  c("galaxy-s26-ultra/clean", "galaxy-s26-ultra", answer("Samsung", "Galaxy S26 Ultra", ["S-Pen", "200MP", "titanium frame"], "smartphone"), 700),
  c("pixel-10-pro/clean", "pixel-10-pro", answer("Google", "Pixel 10 Pro", ["Tensor G5", "bar camera"], "smartphone"), 640),
  c("macbook-pro-m4/clean", "macbook-pro-m4", answer("Apple", "MacBook Pro 14 M4", ["M4 chip", "Liquid Retina XDR", "MagSafe"], "laptop"), 810),
  c("ipad-pro-m4/clean", "ipad-pro-m4", answer("Apple", "iPad Pro 11 M4", ["M4 chip", "OLED", "Apple Pencil Pro"], "tablet"), 590),
  c("airpods-pro-3/clean", "airpods-pro-3", answer("Apple", "AirPods Pro 3", ["ANC", "USB-C case", "H2"], "audio"), 560),
  c("sony-wh1000xm6/clean", "sony-wh1000xm6", answer("Sony", "WH-1000XM6", ["ANC", "multipoint", "30h battery"], "audio"), 575),
  c("apple-watch-ultra-3/clean", "apple-watch-ultra-3", answer("Apple", "Watch Ultra 3", ["titanium", "dual-frequency GPS", "100m water"], "wearable"), 610),
  c("ps5-pro/clean", "ps5-pro", answer("Sony", "PlayStation 5 Pro", ["8K upscale", "2TB SSD", "ray tracing"], "console"), 660),
  c("dyson-v16/clean", "dyson-v16-detect", answer("Dyson", "V16 Detect Absolute", ["laser dust", "240AW", "HEPA"], "home"), 700),
  c("gopro-hero13/clean", "gopro-hero13", answer("GoPro", "HERO13 Black", ["5.3K", "HyperSmooth 6"], "camera"), 540),
  c("logitech-mx-master-4/clean", "logitech-mx-master-4", answer("Logitech", "MX Master 4", ["MagSpeed scroll", "USB-C"], "accessory"), 520),

  // --- in the catalog, the model is vague (brand only, or wrong generation) -----------------------------------------
  c("iphone-16-pro/model-missing", "iphone-16-pro", answer("Apple", null, ["USB-C", "Action Button", "Titane"], "smartphone"), 600),
  c("galaxy-s25-ultra/model-missing", "galaxy-s25-ultra", answer("Samsung", null, ["S-Pen", "200MP", "AI zoom"], "smartphone"), 650),
  c("oneplus-13/features-only", "oneplus-13", answer(null, null, ["Hasselblad", "120Hz", "fast charge"], "smartphone"), 630),
  c("coque-iphone-17-pro/accessory", "coque-iphone-17-pro", answer("Apple", "Coque silicone iPhone 17 Pro", ["MagSafe", "silicone"], "accessory"), 480),
  // the model confuses two generations: a rank-1 miss that top-3 may still recover
  c("iphone-17/generation-confusion", "iphone-17", answer("Apple", "iPhone 16 Pro", ["USB-C", "Dynamic Island", "dual caméra"], "smartphone"), 615),
  c("macbook-air-m4/generation-confusion", "macbook-air-m4", answer("Apple", "MacBook Pro 14 M4", ["M4 chip", "fanless"], "laptop"), 800),

  // --- NOT in the catalog: the right behaviour is to abstain (the full vision model then answers) -------------------
  c("water-dispenser/out-of-catalog", null, answer(null, null, ["distributeur d'eau", "pompe USB", "bouteille"], "home"), 500),
  c("yoga-mat/out-of-catalog", null, answer(null, null, ["tapis", "antidérapant", "mousse"], "other"), 470),
  c("led-strip/out-of-catalog", null, answer(null, null, ["bande LED", "RGB", "télécommande"], "home"), 490),
  c("desk-organizer/out-of-catalog", null, answer(null, null, ["organiseur", "bois", "bureau"], "other"), 455),
  // a brand that exists in the catalog but a product that does not: a lexical matcher is tempted to accept it
  c("apple-charger/out-of-catalog", null, answer("Apple", "Chargeur 20W", ["USB-C", "blanc", "adaptateur"], "accessory"), 505),
  c("samsung-fridge/out-of-catalog", null, answer("Samsung", "Réfrigérateur 4 portes", ["inox", "distributeur de glaçons"], "home"), 520),
]

/**
 * The SIMULATED vision model: replays the scripted answer after the scripted delay. `clock` is the fake clock the bench
 * measures with, so the latency percentiles are deterministic.
 */
export function createSimulatedVisionModel(clock: { advance: (ms: number) => void }) {
  return async (input: SyntheticInput): Promise<string> => {
    clock.advance(input.simulatedLatencyMs)
    return input.modelAnswer
  }
}

export function createFakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 1_000
  return {
    now: () => t,
    advance: (ms) => {
      t += ms
    },
  }
}
