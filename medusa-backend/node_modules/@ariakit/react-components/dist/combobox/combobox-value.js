"use client";
import { useComboboxContext } from "./combobox-context.js";
import { invariant } from "@ariakit/utils";
import { useStoreState } from "@ariakit/react-store";
//#region src/combobox/combobox-value.tsx
/**
* Renders the current
* [`value`](https://ariakit.com/reference/use-combobox-store#value) state in
* the [combobox store](https://ariakit.com/reference/use-combobox-store).
*
* As a value component, it doesn't render any DOM elements and therefore
* doesn't accept HTML props.
*
* It takes a
* [`children`](https://ariakit.com/reference/combobox-value#children) function
* that gets called with the current value as an argument. This can be used as
* an uncontrolled API to render the combobox value in a custom way.
* @see https://ariakit.com/components/combobox
* @example
* ```jsx {3-5}
* <ComboboxProvider>
*   <Combobox />
*   <ComboboxValue>
*     {(value) => `Current value: ${value}`}
*   </ComboboxValue>
* </ComboboxProvider>
* ```
*/
function ComboboxValue({ store, children } = {}) {
	const context = useComboboxContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "ComboboxValue must receive a `store` prop or be wrapped in a ComboboxProvider component.");
	const value = useStoreState(store, "value");
	if (children) return children(value);
	return value;
}
//#endregion
export { ComboboxValue };

//# sourceMappingURL=combobox-value.js.map