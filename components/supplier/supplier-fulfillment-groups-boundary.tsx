"use client"

import { Component, type ReactNode } from "react"

type Props = { children: ReactNode }
type State = { hasError: boolean }

/** Isolates fulfillment parcel UI — supplier orders list stays up if this panel throws. */
export class SupplierFulfillmentGroupsBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error("[supplier-fulfillment-groups]", { error: error.message })
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}
