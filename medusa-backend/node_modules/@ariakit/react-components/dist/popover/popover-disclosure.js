"use client";
import { PopoverScopedContextProvider, usePopoverProviderContext } from "./popover-context.js";
import { useDialogDisclosure } from "../dialog/dialog-disclosure.js";
import { usePopoverAnchor } from "./popover-anchor.js";
import { createElement, createHook, forwardRef, useEvent, useWrapElement } from "@ariakit/react-utils";
import { invariant } from "@ariakit/utils";
import { jsx } from "react/jsx-runtime";
//#region src/popover/popover-disclosure.tsx
const TagName = "button";
/**
* Returns props to create a `PopoverDisclosure` component.
* @see https://ariakit.com/components/popover
* @example
* ```jsx
* const store = usePopoverStore();
* const props = usePopoverDisclosure({ store });
* <Role {...props}>Disclosure</Role>
* <Popover store={store}>Popover</Popover>
* ```
*/
const usePopoverDisclosure = createHook(function usePopoverDisclosure({ store, ...props }) {
	const context = usePopoverProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "PopoverDisclosure must receive a `store` prop or be wrapped in a PopoverProvider component.");
	const onClickProp = props.onClick;
	const onClick = useEvent((event) => {
		store?.setAnchorElement(event.currentTarget);
		onClickProp?.(event);
	});
	props = useWrapElement(props, (element) => /* @__PURE__ */ jsx(PopoverScopedContextProvider, {
		value: store,
		children: element
	}), [store]);
	props = {
		...props,
		onClick
	};
	props = usePopoverAnchor({
		store,
		...props
	});
	props = useDialogDisclosure({
		store,
		...props
	});
	return props;
});
/**
* Renders a button that controls the visibility of the
* [`Popover`](https://ariakit.com/reference/popover) component when clicked.
* @see https://ariakit.com/components/popover
* @example
* ```jsx {2}
* <PopoverProvider>
*   <PopoverDisclosure>Disclosure</PopoverDisclosure>
*   <Popover>Popover</Popover>
* </PopoverProvider>
* ```
*/
const PopoverDisclosure = forwardRef(function PopoverDisclosure(props) {
	return createElement(TagName, usePopoverDisclosure(props));
});
//#endregion
export { PopoverDisclosure, usePopoverDisclosure };

//# sourceMappingURL=popover-disclosure.js.map