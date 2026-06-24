"use client";
import { usePopoverDismiss } from "../popover/popover-dismiss.js";
import { useSelectScopedContext } from "./select-context.js";
import { createElement, createHook, forwardRef } from "@ariakit/react-utils";
//#region src/select/select-dismiss.tsx
const TagName = "button";
/**
* Returns props to create a `SelectDismiss` component.
* @see https://ariakit.com/components/select
* @example
* ```jsx
* const props = useSelectDismiss();
* <Role.button {...props} />
* ```
*/
const useSelectDismiss = createHook(function useSelectDismiss({ store, ...props }) {
	const context = useSelectScopedContext();
	store = store || context;
	props = usePopoverDismiss({
		store,
		...props
	});
	return props;
});
/**
* Renders a button that hides a
* [`SelectPopover`](https://ariakit.com/reference/select-popover) component
* when clicked.
*
* When this component is rendered within
* [`SelectPopover`](https://ariakit.com/reference/select-popover), all
* [`SelectItem`](https://ariakit.com/reference/select-item) elements must be
* rendered within a [`SelectList`](https://ariakit.com/reference/select-list)
* instead of directly within the popover.
* @see https://ariakit.com/components/select
* @example
* ```jsx {4}
* <SelectProvider>
*   <Select />
*   <SelectPopover>
*     <SelectDismiss />
*     <SelectList>
*       <SelectItem value="Apple" />
*       <SelectItem value="Orange" />
*     </SelectList>
*   </SelectPopover>
* </SelectProvider>
* ```
*/
const SelectDismiss = forwardRef(function SelectDismiss(props) {
	return createElement(TagName, useSelectDismiss(props));
});
//#endregion
export { SelectDismiss, useSelectDismiss };

//# sourceMappingURL=select-dismiss.js.map