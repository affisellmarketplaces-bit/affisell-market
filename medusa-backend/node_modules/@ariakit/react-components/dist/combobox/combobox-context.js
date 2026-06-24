"use client";
import { CompositeContextProvider, CompositeScopedContextProvider } from "../composite/composite-context.js";
import { PopoverContextProvider, PopoverScopedContextProvider } from "../popover/popover-context.js";
import { createStoreContext } from "@ariakit/react-utils";
import { createContext } from "react";
//#region src/combobox/combobox-context.tsx
const ComboboxListRoleContext = createContext(void 0);
const ctx = createStoreContext([PopoverContextProvider, CompositeContextProvider], [PopoverScopedContextProvider, CompositeScopedContextProvider]);
/**
* Returns the combobox store from the nearest combobox container.
* @example
* function Combobox() {
*   const store = useComboboxContext();
*
*   if (!store) {
*     throw new Error("Combobox must be wrapped in ComboboxProvider");
*   }
*
*   // Use the store...
* }
*/
const useComboboxContext = ctx.useContext;
const useComboboxScopedContext = ctx.useScopedContext;
const useComboboxProviderContext = ctx.useProviderContext;
const ComboboxContextProvider = ctx.ContextProvider;
const ComboboxScopedContextProvider = ctx.ScopedContextProvider;
const ComboboxItemValueContext = createContext(void 0);
const ComboboxItemCheckedContext = createContext(false);
//#endregion
export { ComboboxContextProvider, ComboboxItemCheckedContext, ComboboxItemValueContext, ComboboxListRoleContext, ComboboxScopedContextProvider, useComboboxContext, useComboboxProviderContext, useComboboxScopedContext };

//# sourceMappingURL=combobox-context.js.map