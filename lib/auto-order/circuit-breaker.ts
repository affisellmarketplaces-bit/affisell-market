type State = { failures: number; openUntil: number }

const states = new Map<string, State>()

const FAILURE_THRESHOLD = 5
const OPEN_MS = 60_000

export function assertCircuitClosed(key: string): void {
  const s = states.get(key)
  if (s && Date.now() < s.openUntil) {
    throw new Error(`circuit_open:${key}`)
  }
}

export function recordCircuitSuccess(key: string) {
  states.delete(key)
}

export function recordCircuitFailure(key: string) {
  const s = states.get(key) ?? { failures: 0, openUntil: 0 }
  s.failures += 1
  if (s.failures >= FAILURE_THRESHOLD) {
    s.openUntil = Date.now() + OPEN_MS
    s.failures = 0
  }
  states.set(key, s)
}
