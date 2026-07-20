/**
 * Canonical World Radar country registry.
 * Prefer this path in docs/scripts; implementation lives in world-countries.ts.
 */
export {
  WORLD_RADAR_COUNTRIES,
  WORLD_RADAR_SCAN_ROTATION,
  getWorldCountry,
  groupCountriesByRegion,
  getCountriesForCronBatch,
  type RadarRegion,
  type WorldCountryDef,
} from "@/lib/radar/world-countries"
