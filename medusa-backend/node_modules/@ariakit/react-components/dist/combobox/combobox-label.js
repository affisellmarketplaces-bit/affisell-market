"use client";
import { useComboboxProviderContext } from "./combobox-context.js";
import { createElement, createHook, forwardRef, memo } from "@ariakit/react-utils";
import { invariant, removeUndefinedValues } from "@ariakit/utils";
import { useStoreState } from "@ariakit/react-store";
//#region src/combobox/combobox-label.tsx
const TagName = "label";
/**
* Returns props to create a `ComboboxLabel` component.
* @see https://ariakit.com/components/combobox
* @example
* ```jsx
* const store = useComboboxStore();
* const props = useComboboxLabel({ store });
* <Role {...props}>Favorite fruit</Role>
* <Combobox store={store} />
* ```
*/
const useComboboxLabel = createHook(function useComboboxLabel({ store, ...props }) {
	const context = useComboboxProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "ComboboxLabel must receive a `store` prop or be wrapped in a ComboboxProvider component.");
	props = {
		htmlFor: useStoreState(store, (state) => state.baseElement?.id),
		...props
	};
	return removeUndefinedValues(props);
});
/**
* Renders a label for the [`Combobox`](https://ariakit.com/reference/combobox)
* component.
* @see https://ariakit.com/components/combobox
* @example
* ```jsx {2}
* <ComboboxProvider>
*   <ComboboxLabel>Favorite fruit</ComboboxLabel>
*   <Combobox />
*   <ComboboxPopover>
*     <ComboboxItem value="Apple" />
*     <ComboboxItem value="Orange" />
*   </ComboboxPopover>
* </ComboboxProvider>
* ```
*/
const ComboboxLabel = memo(forwardRef(function ComboboxLabel(props) {
	return createElement(TagName, useComboboxLabel(props));
}));
//#endregion
export { ComboboxLabel, useComboboxLabel };

//# sourceMappingURL=combobox-label.js.map