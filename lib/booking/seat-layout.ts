export type SeatLayoutCell = {
  label: string
  rowIndex: number
  colIndex: number
}

const ROW_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

/** Build cinema-style labels (A1, A2, B1…) for a slot capacity. */
export function buildSeatLayout(capacity: number, cols = 0): SeatLayoutCell[] {
  const total = Math.max(1, Math.min(500, Math.round(capacity)))
  const columnCount = cols > 0 ? Math.min(20, cols) : Math.min(10, Math.max(4, Math.ceil(Math.sqrt(total))))
  const out: SeatLayoutCell[] = []
  let row = 0
  let col = 0
  for (let i = 0; i < total; i++) {
    const rowLetter = ROW_LETTERS[row] ?? `R${row + 1}`
    out.push({
      label: `${rowLetter}${col + 1}`,
      rowIndex: row,
      colIndex: col,
    })
    col++
    if (col >= columnCount) {
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
