"use client"

import { toast } from "sonner"

import { blockIfHoneypot } from "@/lib/security/honeypot-client"

import { HoneypotField } from "./honeypot-field"

type SecureFormWrapperProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  onSubmit?: React.FormEventHandler<HTMLFormElement>
}

export function SecureFormWrapper({ onSubmit, children, ...props }: SecureFormWrapperProps) {
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    const formData = new FormData(e.currentTarget)
    if (blockIfHoneypot(formData)) {
      e.preventDefault()
      toast.error("Bot detected")
      return
    }
    onSubmit?.(e)
  }

  return (
    <form {...props} onSubmit={handleSubmit}>
      <HoneypotField />
      {children}
    </form>
  )
}
