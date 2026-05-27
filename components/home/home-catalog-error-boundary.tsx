"use client"

import { Component, type ReactNode } from "react"

import { HomeCatalogClientFallback } from "@/components/home/home-catalog-client-fallback"

type Props = {
  children: ReactNode
}

type State = { hasError: boolean; message: string | null }

/** Keeps header/nav alive when the embedded catalog client tree throws (common on mobile Safari). */
export class HomeCatalogErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || null }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[home-catalog]", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <HomeCatalogClientFallback
          message={this.state.message}
          onRetry={() => this.setState({ hasError: false, message: null })}
        />
      )
    }
    return this.props.children
  }
}
