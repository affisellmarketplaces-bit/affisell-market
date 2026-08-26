"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

type Props = { children: ReactNode }

type State = { error: Error | null }

export class IngAdminBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ing]", {
      result: "ui_boundary",
      message: error.message,
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg rounded-2xl border border-red-200/80 bg-red-50/90 p-6 text-center dark:border-red-900/50 dark:bg-red-950/40">
          <AlertTriangle className="mx-auto size-8 text-red-600 dark:text-red-400" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-red-900 dark:text-red-100">Ing panel error</p>
          <p className="mt-1 text-xs text-red-800/80 dark:text-red-200/80">{this.state.error.message}</p>
          <button
            type="button"
            className={buttonVariants({ size: "sm", className: "mt-4" })}
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
