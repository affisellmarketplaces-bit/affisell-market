"use client";
import { usePopoverContext } from "./popover-context.js";
import { createElement, createHook, forwardRef } from "@ariakit/react-utils";
import { invariant, removeUndefinedValues } from "@ariakit/utils";
import { useMemo } from "react";
import { jsx } from "react/jsx-runtime";
import { useStoreState } from "@ariakit/react-store";
//#region src/popover/popover-disclosure-arrow.tsx
const TagName = "span";
const pointsMap = {
	top: "4,10 8,6 12,10",
	right: "6,4 10,8 6,12",
	bottom: "4,6 8,10 12,6",
	left: "10,4 6,8 10,12"
};
/**
* Returns props to create a `PopoverDisclosureArrow` component.
* @see https://ariakit.com/components/popover
* @example
* ```jsx
* const store = usePopoverStore();
* const props = usePopoverDisclosureArrow({ store });
* <PopoverDisclosure store={store}>
*   Disclosure
*   <Role {...props} />
* </PopoverDisclosure>
* ```
*/
const usePopoverDisclosureArrow = createHook(function usePopoverDisclosureArrow({ store, placement, ...props }) {
	const context = usePopoverContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "PopoverDisclosureArrow must be wrapped in a PopoverDisclosure component.");
	const points = pointsMap[useStoreState(store, (state) => placement || state.placement).split("-")[0]];
	props = {
		children: useMemo(() => /* @__PURE__ */ jsx("svg", {
			display: "block",
			fill: "none",
			stroke: "currentColor",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			strokeWidth: 1.5,
			viewBox: "0 0 16 16",
			height: "1em",
			width: "1em",
			children: /* @__PURE__ */ jsx("polyline", { points })
		}), [points]),
		"aria-hidden": true,
		...props,
		style: {
			width: "1em",
			height: "1em",
			pointerEvents: "none",
			...props.style
		}
	};
	return removeUndefinedValues(props);
});
/**
* Renders an arrow pointing to the popover position. It's usually rendered
* inside the
* [`PopoverDisclosure`](https://ariakit.com/reference/popover-disclosure)
* component.
* @see https://ariakit.com/components/popover
* @example
* ```jsx {4}
* <PopoverProvider>
*   <PopoverDisclosure>
*     Disclosure
*     <PopoverDisclosureArrow />
*   </PopoverDisclosure>
*   <Popover>Popover</Popover>
* </PopoverProvider>
* ```
*/
const PopoverDisclosureArrow = forwardRef(function PopoverDisclosureArrow(props) {
	return createElement(TagName, usePopoverDisclosureArrow(props));
});
//#endregion
export { PopoverDisclosureArrow, usePopoverDisclosureArrow };

//# sourceMappingURL=popover-disclosure-arrow.js.map