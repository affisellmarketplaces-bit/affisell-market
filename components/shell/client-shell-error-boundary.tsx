"use client"

import { Component, type ReactNode } from "react"

type Props = {
  children: ReactNode
  label: string
}

type State = { failed: boolean }

/** PWA / analytics / nav extras must never replace the whole page on chunk timeout. */
export class ClientShellErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.warn("[client-shell-error-boundary]", {
      label: this.props.label,
      error: error.message,
    })
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}
