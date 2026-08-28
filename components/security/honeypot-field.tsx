import type { Ref } from "react"

import { HONEYPOT_FIELD } from "@/lib/security/honeypot-constants"

type HoneypotFieldProps = {
  inputRef?: Ref<HTMLInputElement>
}

/** Visually hidden decoy input — bots often auto-fill `website_url`. */
export function HoneypotField({ inputRef }: HoneypotFieldProps) {
  return (
    <input
      ref={inputRef}
      name={HONEYPOT_FIELD}
      type="text"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
    />
  )
}
