"use client";
import { CompositeContextProvider, CompositeScopedContextProvider } from "../composite/composite-context.js";
import { PopoverContextProvider, PopoverScopedContextProvider } from "../popover/popover-context.js";
import { createStoreContext } from "@ariakit/react-utils";
import { createContext } from "react";
//#region src/select/select-context.tsx
const ctx = createStoreContext([PopoverContextProvider, CompositeContextProvider], [PopoverScopedContextProvider, CompositeScopedContextProvider]);
/**
* Returns the select store from the nearest select container.
* @example
* function Select() {
*   const store = useSelectContext();
*
*   if (!store) {
*     throw new Error("Select must be wrapped in SelectProvider");
*   }
*
*   // Use the store...
* }
*/
const useSelectContext = ctx.useContext;
const useSelectScopedContext = ctx.useScopedContext;
const useSelectProviderContext = ctx.useProviderContext;
const SelectContextProvider = ctx.ContextProvider;
const SelectScopedContextProvider = ctx.ScopedContextProvider;
const SelectItemCheckedContext = createContext(false);
const SelectHeadingContext = createContext(null);
//#endregion
export { SelectContextProvider, SelectHeadingContext, SelectItemCheckedContext, SelectScopedContextProvider, useSelectContext, useSelectProviderContext, useSelectScopedContext };

//# sourceMappingURL=select-context.js.map