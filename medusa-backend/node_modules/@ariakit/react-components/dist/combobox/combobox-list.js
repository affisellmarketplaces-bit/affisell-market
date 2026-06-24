"use client";
import { ComboboxListRoleContext, ComboboxScopedContextProvider, useComboboxContext, useComboboxScopedContext } from "./combobox-context.js";
import { isHidden } from "../disclosure/disclosure-content.js";
import { createElement, createHook, forwardRef, useAttribute, useId, useMergeRefs, useSafeLayoutEffect, useWrapElement } from "@ariakit/react-utils";
import { invariant, removeUndefinedValues } from "@ariakit/utils";
import { useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
import { useStoreState } from "@ariakit/react-store";
//#region src/combobox/combobox-list.tsx
const TagName = "div";
/**
* Returns props to create a `ComboboxList` component.
* @see https://ariakit.com/components/combobox
* @example
* ```jsx
* const store = useComboboxStore();
* const props = useComboboxList({ store });
* <Role {...props}>
*   <ComboboxItem value="Item 1" />
*   <ComboboxItem value="Item 2" />
*   <ComboboxItem value="Item 3" />
* </Role>
* ```
*/
const useComboboxList = createHook(function useComboboxList({ store, alwaysVisible, ...props }) {
	const scopedContext = useComboboxScopedContext(true);
	const context = useComboboxContext();
	store = store || context;
	const scopedContextSameStore = !!store && store === scopedContext;
	invariant(store, process.env.NODE_ENV !== "production" && "ComboboxList must receive a `store` prop or be wrapped in a ComboboxProvider component.");
	const ref = useRef(null);
	const id = useId(props.id);
	const mounted = useStoreState(store, "mounted");
	const hidden = isHidden(mounted, props.hidden, alwaysVisible);
	const style = hidden ? {
		...props.style,
		display: "none"
	} : props.style;
	const multiSelectable = useStoreState(store, (state) => Array.isArray(state.selectedValue));
	const role = useAttribute(ref, "role", props.role);
	const ariaMultiSelectable = role === "listbox" || role === "tree" || role === "grid" ? multiSelectable || void 0 : void 0;
	const [hasListboxInside, setHasListboxInside] = useState(false);
	const contentElement = useStoreState(store, "contentElement");
	useSafeLayoutEffect(() => {
		if (!mounted) return;
		const element = ref.current;
		if (!element) return;
		if (contentElement !== element) return;
		const callback = () => {
			setHasListboxInside(!!element.querySelector("[role='listbox']"));
		};
		const observer = new MutationObserver(callback);
		observer.observe(element, {
			subtree: true,
			childList: true,
			attributeFilter: ["role"]
		});
		callback();
		return () => observer.disconnect();
	}, [mounted, contentElement]);
	if (!hasListboxInside) props = {
		role: "listbox",
		"aria-multiselectable": ariaMultiSelectable,
		...props
	};
	props = useWrapElement(props, (element) => /* @__PURE__ */ jsx(ComboboxScopedContextProvider, {
		value: store,
		children: /* @__PURE__ */ jsx(ComboboxListRoleContext.Provider, {
			value: role,
			children: element
		})
	}), [store, role]);
	const setContentElement = id && (!scopedContext || !scopedContextSameStore) ? store.setContentElement : null;
	props = {
		hidden,
		...props,
		id,
		ref: useMergeRefs(setContentElement, ref, props.ref),
		style
	};
	return removeUndefinedValues(props);
});
/**
* Renders a combobox list. The `role` prop is set to `listbox` by default, but
* can be overriden by any other valid combobox popup role (`listbox`, `menu`,
* `tree`, `grid` or `dialog`).
* @see https://ariakit.com/components/combobox
* @example
* ```jsx {3-7}
* <ComboboxProvider>
*   <Combobox />
*   <ComboboxList>
*     <ComboboxItem value="Apple" />
*     <ComboboxItem value="Banana" />
*     <ComboboxItem value="Orange" />
*   </ComboboxList>
* </ComboboxProvider>
* ```
*/
const ComboboxList = forwardRef(function ComboboxList(props) {
	return createElement(TagName, useComboboxList(props));
});
//#endregion
export { ComboboxList, useComboboxList };

//# sourceMappingURL=combobox-list.js.map