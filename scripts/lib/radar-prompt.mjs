/**
 * World Radar seed — the terminal, read-only (RSK-90, lot A). It asks ONE question and returns what was typed; it cannot mint a
 * token, resolve a target or create a client. The decision about the answer is made by `radar-target.mjs`.
 *
 * Ctrl-C at the prompt is reported as "aborted" (exit 130); a closed stdin (Ctrl-D, a pipe that ended) is reported as "closed"
 * (a refusal). Neither is ever a success.
 */
import { createInterface } from "node:readline"

/** Interactive = a real terminal on both ends. A pipe or a CI log is not. */
export function isInteractiveTerminal() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

/**
 * @param {string} question
 * @returns {Promise<{ kind: "answer", text: string } | { kind: "aborted" } | { kind: "closed" }>}
 */
export function askRadarProof(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    let settled = false
    const settle = (/** @type {{ kind: "answer", text: string } | { kind: "aborted" } | { kind: "closed" }} */ result) => {
      if (settled) return
      settled = true
      rl.close()
      resolve(result)
    }
    rl.on("SIGINT", () => settle({ kind: "aborted" }))
    rl.on("close", () => settle({ kind: "closed" }))
    rl.question(question, (answer) => settle({ kind: "answer", text: answer.trim() }))
  })
}
