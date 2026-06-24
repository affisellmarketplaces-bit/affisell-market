"use client";
import { useComboboxProviderContext } from "./combobox-context.js";
import { useComboboxList } from "./combobox-list.js";
import { createDialogComponent } from "../dialog/dialog.js";
import { usePopover } from "../popover/popover.js";
import { createElement, createHook, forwardRef } from "@ariakit/react-utils";
import { getDocument, invariant, isFalsyBooleanCallback } from "@ariakit/utils";
import { useRef } from "react";
import { useStoreState } from "@ariakit/react-store";
//#region src/combobox/combobox-popover.tsx
const TagName = "div";
function isController(target, ...ids) {
	if (!target) return false;
	if ("id" in target) {
		const selector = ids.filter(Boolean).map((id) => `[aria-controls~="${id}"]`).join(", ");
		if (!selector) return false;
		return target.matches(selector);
	}
	return false;
}
/**
* Returns props to create a `ComboboxPopover` component.
* @see https://ariakit.com/components/combobox
* @example
* ```jsx
* const store = useComboboxStore();
* const props = useComboboxPopover({ store });
* <Role {...props}>
*   <ComboboxItem value="Item 1" />
*   <ComboboxItem value="Item 2" />
*   <ComboboxItem value="Item 3" />
* </Role>
* ```
*/
const useComboboxPopover = createHook(function useComboboxPopover({ store, modal, tabIndex, alwaysVisible, autoFocusOnHide = true, hideOnInteractOutside = true, ...props }) {
	const context = useComboboxProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "ComboboxPopover must receive a `store` prop or be wrapped in a ComboboxProvider component.");
	const baseElement = useStoreState(store, "baseElement");
	const hiddenByClickOutsideRef = useRef(false);
	const treeSnapshotKey = useStoreState(store.tag, (state) => state?.renderedItems.length);
	props = useComboboxList({
		store,
		alwaysVisible,
		...props
	});
	props = usePopover({
		store,
		modal,
		alwaysVisible,
		backdrop: false,
		autoFocusOnShow: false,
		finalFocus: baseElement,
		preserveTabOrderAnchor: null,
		unstable_treeSnapshotKey: treeSnapshotKey,
		...props,
		getPersistentElements() {
			const elements = props.getPersistentElements?.() || [];
			if (!modal) return elements;
			if (!store) return elements;
			const { contentElement, baseElement } = store.getState();
			if (!baseElement) return elements;
			const doc = getDocument(baseElement);
			const selectors = [];
			if (contentElement?.id) selectors.push(`[aria-controls~="${contentElement.id}"]`);
			if (baseElement?.id) selectors.push(`[aria-controls~="${baseElement.id}"]`);
			if (!selectors.length) return [...elements, baseElement];
			const selector = selectors.join(",");
			const controlElements = doc.querySelectorAll(selector);
			return [...elements, ...controlElements];
		},
		autoFocusOnHide(element) {
			if (isFalsyBooleanCallback(autoFocusOnHide, element)) return false;
			if (hiddenByClickOutsideRef.current) {
				hiddenByClickOutsideRef.current = false;
				return false;
			}
			return true;
		},
		hideOnInteractOutside(event) {
			const state = store?.getState();
			const contentId = state?.contentElement?.id;
			const baseId = state?.baseElement?.id;
			if (isController(event.target, contentId, baseId)) return false;
			const result = typeof hideOnInteractOutside === "function" ? hideOnInteractOutside(event) : hideOnInteractOutside;
			if (result) hiddenByClickOutsideRef.current = event.type === "click";
			return result;
		}
	});
	return props;
});
/**
* Renders a combobox popover. The `role` prop is set to `listbox` by default,
* but can be overriden by any other valid combobox popup role (`listbox`,
* `menu`, `tree`, `grid` or `dialog`).
* @see https://ariakit.com/components/combobox
* @example
* ```jsx {3-7}
* <ComboboxProvider>
*   <Combobox />
*   <ComboboxPopover>
*     <ComboboxItem value="Apple" />
*     <ComboboxItem value="Banana" />
*     <ComboboxItem value="Orange" />
*   </ComboboxPopover>
* </ComboboxProvider>
* ```
*/
const ComboboxPopover = createDialogComponent(forwardRef(function ComboboxPopover(props) {
	return createElement(TagName, useComboboxPopover(props));
}), useComboboxProviderContext);
//#endregion
export { ComboboxPopover, useComboboxPopover };

//# sourceMappingURL=combobox-popover.js.map