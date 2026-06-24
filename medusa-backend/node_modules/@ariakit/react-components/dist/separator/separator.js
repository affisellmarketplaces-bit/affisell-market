"use client";
import { createElement, createHook, forwardRef } from "@ariakit/react-utils";
//#region src/separator/separator.tsx
const TagName = "hr";
/**
* Returns props to create a `Separator` component.
* @see https://ariakit.com/components/separator
* @example
* ```jsx
* const props = useSeparator({ orientation: "horizontal" });
* <Role {...props} />
* ```
*/
const useSeparator = createHook(function useSeparator({ orientation = "horizontal", ...props }) {
	props = {
		role: "separator",
		"aria-orientation": orientation,
		...props
	};
	return props;
});
/**
* Renders a separator element.
* @see https://ariakit.com/components/separator
* @example
* ```jsx
* <Separator orientation="horizontal" />
* ```
*/
const Separator = forwardRef(function Separator(props) {
	return createElement(TagName, useSeparator(props));
});
//#endregion
export { Separator, useSeparator };

//# sourceMappingURL=separator.js.map