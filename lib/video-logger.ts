type LogLevel = "info" | "warn" | "error"

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    scope: "video",
    message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
    ts: new Date().toISOString(),
  }
  const line = JSON.stringify(payload)
  if (level === "error") {
    process.stderr.write(`${line}\n`)
  } else {
    process.stdout.write(`${line}\n`)
  }
}

/** Structured logger for video generation (no raw console.log in app code). */
export const videoLog = {
  info(message: string, meta?: Record<string, unknown>) {
    emit("info", message, meta)
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit("warn", message, meta)
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit("error", message, meta)
  },
}
