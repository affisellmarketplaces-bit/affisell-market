import { create } from "zustand"

import type { VariantRowValidationIssue } from "@/lib/supplier-sku-builder"

export type WizardStep = 1 | 2 | 3

type WizardState = {
  step: WizardStep
  step1Valid: boolean
  step2Valid: boolean
  skuErrors: VariantRowValidationIssue[]
  setStep1Valid: (valid: boolean) => void
  setStep2Valid: (valid: boolean) => void
  setSkuErrors: (errors: VariantRowValidationIssue[]) => void
  setStep: (step: WizardStep) => void
  trySetStep: (step: WizardStep) => boolean
  nextStep: () => boolean
  prevStep: () => void
  resetWizard: () => void
}

function canReachStep(state: Pick<WizardState, "step1Valid" | "step2Valid">, target: WizardStep): boolean {
  if (target === 1) return true
  if (target === 2) return state.step1Valid
  if (target === 3) return state.step1Valid && state.step2Valid
  return false
}

export const useSupplierProductWizardStore = create<WizardState>((set, get) => ({
  step: 1,
  step1Valid: false,
  step2Valid: false,
  skuErrors: [],
  setStep1Valid: (step1Valid) => set({ step1Valid }),
  setStep2Valid: (step2Valid) => set({ step2Valid }),
  setSkuErrors: (skuErrors) => set({ skuErrors }),
  setStep: (step) => {
    if (!canReachStep(get(), step)) return
    set({ step })
  },
  trySetStep: (step) => {
    if (!canReachStep(get(), step)) return false
    set({ step })
    return true
  },
  nextStep: () => {
    const { step } = get()
    const next = (step + 1) as WizardStep
    if (next > 3) return false
    return get().trySetStep(next)
  },
  prevStep: () => {
    const { step } = get()
    if (step <= 1) return
    set({ step: (step - 1) as WizardStep })
  },
  resetWizard: () =>
    set({
      step: 1,
      step1Valid: false,
      step2Valid: false,
      skuErrors: [],
    }),
}))
