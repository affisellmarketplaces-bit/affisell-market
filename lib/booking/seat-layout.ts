export type SeatLayoutPreset = "GRID" | "CINEMA_VIP"

export type BookingSeatLayoutConfig = {
  preset: SeatLayoutPreset
  /** Seats per row (CINEMA_VIP default 10). */
  cols?: number
  /** 0-based row indices styled as VIP (default front 2 rows). */
  vipRowIndices?: number[]
  /** Insert visual aisle after these 0-based seat column indices (e.g. [4, 8]). */
  aisleAfterCols?: number[]
  /** Seat labels reserved (wheelchair companion…) — not bookable. */
  blockedLabels?: string[]
  /** Extra HT cents per VIP seat (EXPERIENCE checkout). */
  vipSeatSurchargeCents?: number
}

export type SeatLayoutCell = {
  label: string
  rowIndex: number
  /** Seat column within the row (0..cols-1). */
  colIndex: number
  /** Grid column including aisle gaps — for CSS grid placement. */
  displayColIndex: number
  tier: "STANDARD" | "VIP"
  blocked: boolean
}

const ROW_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

export const DEFAULT_GRID_LAYOUT: BookingSeatLayoutConfig = { preset: "GRID" }

export const DEFAULT_CINEMA_VIP_LAYOUT: BookingSeatLayoutConfig = {
  preset: "CINEMA_VIP",
  cols: 10,
  vipRowIndices: [0, 1],
  aisleAfterCols: [4, 8],
}

export function parseBookingSeatLayout(raw: unknown): BookingSeatLayoutConfig | null {
  if (raw === undefined || raw === null || raw === "") return null
  if (typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const presetRaw = typeof o.preset === "string" ? o.preset.trim().toUpperCase() : "GRID"
  const preset: SeatLayoutPreset = presetRaw === "CINEMA_VIP" ? "CINEMA_VIP" : "GRID"

  const colsRaw = Math.round(Number(o.cols))
  const cols =
    Number.isFinite(colsRaw) && colsRaw >= 4 && colsRaw <= 20 ? colsRaw : undefined

  const vipRowIndices = Array.isArray(o.vipRowIndices)
    ? o.vipRowIndices
        .map((v) => Math.round(Number(v)))
        .filter((n) => Number.isFinite(n) && n >= 0 && n < 50)
    : undefined

  const aisleAfterCols = Array.isArray(o.aisleAfterCols)
    ? o.aisleAfterCols
        .map((v) => Math.round(Number(v)))
        .filter((n) => Number.isFinite(n) && n >= 0 && n < 20)
        .sort((a, b) => a - b)
    : undefined

  const blockedLabels = Array.isArray(o.blockedLabels)
    ? [...new Set(o.blockedLabels.map((v) => String(v).trim()).filter(Boolean))].slice(0, 50)
    : undefined

  const surchargeRaw = Math.round(Number(o.vipSeatSurchargeCents))
  const vipSeatSurchargeCents =
    Number.isFinite(surchargeRaw) && surchargeRaw >= 0 && surchargeRaw <= 500_00
      ? surchargeRaw
      : undefined

  return {
    preset,
    ...(cols !== undefined ? { cols } : {}),
    ...(vipRowIndices && vipRowIndices.length > 0 ? { vipRowIndices } : {}),
    ...(aisleAfterCols && aisleAfterCols.length > 0 ? { aisleAfterCols } : {}),
    ...(blockedLabels && blockedLabels.length > 0 ? { blockedLabels } : {}),
    ...(vipSeatSurchargeCents !== undefined ? { vipSeatSurchargeCents } : {}),
  }
}

export function resolveSeatLayoutConfig(
  raw: unknown,
  listingKind: string
): BookingSeatLayoutConfig {
  const parsed = parseBookingSeatLayout(raw)
  if (parsed) return normalizeLayoutConfig(parsed, listingKind)
  return { ...DEFAULT_GRID_LAYOUT }
}

function normalizeLayoutConfig(
  config: BookingSeatLayoutConfig,
  listingKind: string
): BookingSeatLayoutConfig {
  const k = listingKind.trim().toUpperCase()
  if (k !== "EXPERIENCE" || config.preset === "GRID") {
    return { preset: "GRID", ...(config.cols ? { cols: config.cols } : {}) }
  }
  const cols = config.cols ?? DEFAULT_CINEMA_VIP_LAYOUT.cols ?? 10
  return {
    preset: "CINEMA_VIP",
    cols,
    vipRowIndices: config.vipRowIndices ?? DEFAULT_CINEMA_VIP_LAYOUT.vipRowIndices,
    aisleAfterCols: config.aisleAfterCols ?? DEFAULT_CINEMA_VIP_LAYOUT.aisleAfterCols,
    blockedLabels: config.blockedLabels,
    ...(config.vipSeatSurchargeCents !== undefined
      ? { vipSeatSurchargeCents: config.vipSeatSurchargeCents }
      : {}),
  }
}

export function displayColIndexForSeat(colIndex: number, aisleAfterCols: number[]): number {
  const gaps = aisleAfterCols.filter((a) => colIndex > a).length
  return colIndex + gaps
}

export function gridColumnCount(config: BookingSeatLayoutConfig): number {
  const cols = config.cols ?? (config.preset === "CINEMA_VIP" ? 10 : Math.min(10, 8))
  const aisle = config.aisleAfterCols ?? []
  return cols + aisle.length
}

function isVipRow(rowIndex: number, config: BookingSeatLayoutConfig): boolean {
  const vip = config.vipRowIndices ?? []
  return vip.includes(rowIndex)
}

/** Build cinema-style labels (A1, A2, B1…) for a slot capacity. */
export function buildSeatLayout(
  capacity: number,
  configOrCols?: BookingSeatLayoutConfig | number
): SeatLayoutCell[] {
  const total = Math.max(1, Math.min(500, Math.round(capacity)))

  let config: BookingSeatLayoutConfig
  if (typeof configOrCols === "number") {
    config = { preset: "GRID", cols: configOrCols > 0 ? configOrCols : undefined }
  } else if (configOrCols) {
    config = configOrCols
  } else {
    config = DEFAULT_GRID_LAYOUT
  }

  if (config.preset === "GRID") {
    const columnCount =
      config.cols && config.cols > 0
        ? Math.min(20, config.cols)
        : Math.min(10, Math.max(4, Math.ceil(Math.sqrt(total))))
    return buildGridLayout(total, columnCount, config)
  }

  return buildCinemaVipLayout(total, config)
}

function buildGridLayout(
  total: number,
  columnCount: number,
  config: BookingSeatLayoutConfig
): SeatLayoutCell[] {
  const blocked = new Set((config.blockedLabels ?? []).map((l) => l.toUpperCase()))
  const out: SeatLayoutCell[] = []
  let row = 0
  let col = 0
  for (let i = 0; i < total; i++) {
    const rowLetter = ROW_LETTERS[row] ?? `R${row + 1}`
    const label = `${rowLetter}${col + 1}`
    out.push({
      label,
      rowIndex: row,
      colIndex: col,
      displayColIndex: col,
      tier: "STANDARD",
      blocked: blocked.has(label.toUpperCase()),
    })
    col++
    if (col >= columnCount) {
      col = 0
      row++
    }
  }
  return out
}

function buildCinemaVipLayout(total: number, config: BookingSeatLayoutConfig): SeatLayoutCell[] {
  const cols = Math.min(20, Math.max(4, config.cols ?? 10))
  const aisleAfterCols = config.aisleAfterCols ?? []
  const blocked = new Set((config.blockedLabels ?? []).map((l) => l.toUpperCase()))
  const out: SeatLayoutCell[] = []
  let row = 0
  let col = 0
  let placed = 0

  while (placed < total) {
    const rowLetter = ROW_LETTERS[row] ?? `R${row + 1}`
    const label = `${rowLetter}${col + 1}`
    const tier = isVipRow(row, config) ? "VIP" : "STANDARD"
    out.push({
      label,
      rowIndex: row,
      colIndex: col,
      displayColIndex: displayColIndexForSeat(col, aisleAfterCols),
      tier,
      blocked: blocked.has(label.toUpperCase()),
    })
    placed++
    col++
    if (col >= cols) {
      col = 0
      row++
    }
  }
  return out
}

export function usesNamedSeatMap(listingKind: string, capacity: number): boolean {
  const k = listingKind.trim().toUpperCase()
  return k === "EXPERIENCE" && capacity > 1
}

export function layoutPreviewCapacity(config: BookingSeatLayoutConfig, fallback = 30): number {
  const cols = config.cols ?? 10
  const rows =
    config.preset === "CINEMA_VIP"
      ? Math.max(3, Math.ceil(fallback / cols))
      : Math.max(2, Math.ceil(fallback / cols))
  return Math.min(500, cols * rows)
}
