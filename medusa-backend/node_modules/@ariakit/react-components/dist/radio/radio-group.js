"use client";
import { useComposite } from "../composite/composite.js";
import { RadioScopedContextProvider, useRadioProviderContext } from "./radio-context.js";
import { createElement, createHook, forwardRef, useWrapElement } from "@ariakit/react-utils";
import { invariant } from "@ariakit/utils";
import { jsx } from "react/jsx-runtime";
//#region src/radio/radio-group.tsx
const TagName = "div";
/**
* Returns props to create a `RadioGroup` component.
* @see https://ariakit.com/components/radio
* @example
* ```jsx
* const store = useRadioStore();
* const props = useRadioGroup({ store });
* <Role {...props}>
*   <Radio value="Apple" />
*   <Radio value="Orange" />
* </Role>
* ```
*/
const useRadioGroup = createHook(function useRadioGroup({ store, ...props }) {
	const context = useRadioProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "RadioGroup must receive a `store` prop or be wrapped in a RadioProvider component.");
	props = useWrapElement(props, (element) => /* @__PURE__ */ jsx(RadioScopedContextProvider, {
		value: store,
		children: element
	}), [store]);
	props = {
		role: "radiogroup",
		...props
	};
	props = useComposite({
		store,
		...props
	});
	return props;
});
/**
* Renders a [`radiogroup`](https://w3c.github.io/aria/#radiogroup) element that
* manages a group of [`Radio`](https://ariakit.com/reference/radio) elements.
* @see https://ariakit.com/components/radio
* @example
* ```jsx
* <RadioProvider>
*   <RadioGroup>
*     <Radio value="Apple" />
*     <Radio value="Orange" />
*   </RadioGroup>
* </RadioProvider>
* ```
*/
const RadioGroup = forwardRef(function RadioGroup(props) {
	return createElement(TagName, useRadioGroup(props));
});
//#endregion
export { RadioGroup, useRadioGroup };

//# sourceMappingURL=radio-group.js.map