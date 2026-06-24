"use client";
import { useHovercardScopedContext } from "./hovercard-context.js";
import { usePopoverDismiss } from "../popover/popover-dismiss.js";
import { createElement, createHook, forwardRef } from "@ariakit/react-utils";
//#region src/hovercard/hovercard-dismiss.tsx
const TagName = "button";
/**
* Returns props to create a `HovercardDismiss` component.
* @see https://ariakit.com/components/hovercard
* @example
* ```jsx
* const store = useHovercardStore();
* const props = useHovercardDismiss({ store });
* <Hovercard store={store}>
*   <Role {...props} />
* </Hovercard>
* ```
*/
const useHovercardDismiss = createHook(function useHovercardDismiss({ store, ...props }) {
	const context = useHovercardScopedContext();
	store = store || context;
	props = usePopoverDismiss({
		store,
		...props
	});
	return props;
});
/**
* Renders a button that hides a
* [`Hovercard`](https://ariakit.com/reference/hovercard) when clicked.
* @see https://ariakit.com/components/hovercard
* @example
* ```jsx {3}
* <HovercardProvider>
*   <Hovercard>
*     <HovercardDismiss />
*   </Hovercard>
* </HovercardProvider>
* ```
*/
const HovercardDismiss = forwardRef(function HovercardDismiss(props) {
	return createElement(TagName, useHovercardDismiss(props));
});
//#endregion
export { HovercardDismiss, useHovercardDismiss };

//# sourceMappingURL=hovercard-dismiss.js.map