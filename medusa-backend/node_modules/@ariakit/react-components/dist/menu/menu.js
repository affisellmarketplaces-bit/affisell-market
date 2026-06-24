"use client";
import { createDialogComponent } from "../dialog/dialog.js";
import { useHovercard } from "../hovercard/hovercard.js";
import { useMenuProviderContext } from "./menu-context.js";
import { useMenuList } from "./menu-list.js";
import { createElement, createHook, forwardRef, useMergeRefs } from "@ariakit/react-utils";
import { fireEvent, hasFocusWithin, invariant, isFalsyBooleanCallback } from "@ariakit/utils";
import { createRef, useEffect, useMemo, useRef, useState } from "react";
import { useStoreState } from "@ariakit/react-store";
//#region src/menu/menu.tsx
const TagName = "div";
/**
* Returns props to create a `Menu` component.
* @see https://ariakit.com/components/menu
* @example
* ```jsx
* const store = useMenuStore();
* const props = useMenu({ store });
* <MenuButton store={store}>Edit</MenuButton>
* <Role {...props}>
*   <MenuItem>Undo</MenuItem>
*   <MenuItem>Redo</MenuItem>
* </Role>
* ```
*/
const useMenu = createHook(function useMenu({ store, modal: modalProp = false, portal = modalProp, hideOnEscape = true, autoFocusOnShow = true, hideOnHoverOutside, alwaysVisible, ...props }) {
	const context = useMenuProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "Menu must receive a `store` prop or be wrapped in a MenuProvider component.");
	const ref = useRef(null);
	const parentMenu = store.parent;
	const parentMenubar = store.menubar;
	const hasParentMenu = !!parentMenu;
	const parentIsMenubar = !!parentMenubar && !hasParentMenu;
	const modal = hasParentMenu ? false : modalProp;
	props = {
		...props,
		ref: useMergeRefs(ref, props.ref)
	};
	const { "aria-labelledby": ariaLabelledBy, ...menuListProps } = useMenuList({
		store,
		alwaysVisible,
		...props
	});
	props = menuListProps;
	const [initialFocusRef, setInitialFocusRef] = useState();
	const autoFocusOnShowState = useStoreState(store, "autoFocusOnShow");
	const initialFocus = useStoreState(store, "initialFocus");
	const baseElement = useStoreState(store, "baseElement");
	const items = useStoreState(store, "renderedItems");
	useEffect(() => {
		let cleaning = false;
		setInitialFocusRef((prevInitialFocusRef) => {
			if (cleaning) return;
			if (modal && prevInitialFocusRef?.current?.isConnected) return prevInitialFocusRef;
			if (!autoFocusOnShowState) return;
			let element;
			switch (initialFocus) {
				case "first":
					element = items.find((item) => !item.disabled && item.element)?.element || null;
					break;
				case "last":
					element = [...items].reverse().find((item) => !item.disabled && item.element)?.element || null;
					break;
				default: element = baseElement;
			}
			if (element && element === prevInitialFocusRef?.current) return prevInitialFocusRef;
			const ref = createRef();
			ref.current = element;
			return ref;
		});
		return () => {
			cleaning = true;
		};
	}, [
		store,
		modal,
		autoFocusOnShowState,
		initialFocus,
		items,
		baseElement
	]);
	const canAutoFocusOnShow = !!initialFocusRef || !!props.initialFocus || modal;
	const autoFocusOnShowProp = autoFocusOnShow === false ? false : canAutoFocusOnShow && autoFocusOnShow;
	const contentElement = useStoreState(store.combobox || store, "contentElement");
	const parentContentElement = useStoreState(parentMenu?.combobox || parentMenu, "contentElement");
	const preserveTabOrderAnchor = useMemo(() => {
		if (!parentContentElement) return;
		if (!contentElement) return;
		const role = contentElement.getAttribute("role");
		const parentRole = parentContentElement.getAttribute("role");
		if ((parentRole === "menu" || parentRole === "menubar") && role === "menu") return;
		return parentContentElement;
	}, [contentElement, parentContentElement]);
	if (preserveTabOrderAnchor !== void 0) props = {
		preserveTabOrderAnchor,
		...props
	};
	props = useHovercard({
		store,
		alwaysVisible,
		initialFocus: initialFocusRef,
		autoFocusOnShow: autoFocusOnShowProp,
		...props,
		hideOnEscape(event) {
			if (isFalsyBooleanCallback(hideOnEscape, event)) return false;
			store?.hideAll();
			return true;
		},
		hideOnHoverOutside(event) {
			const disclosureElement = store?.getState().disclosureElement;
			const getHideOnHoverOutside = () => {
				if (typeof hideOnHoverOutside === "function") return hideOnHoverOutside(event);
				if (hideOnHoverOutside != null) return hideOnHoverOutside;
				if (hasParentMenu) return true;
				if (!parentIsMenubar) return false;
				if (!disclosureElement) return true;
				if (hasFocusWithin(disclosureElement)) return false;
				return true;
			};
			if (!getHideOnHoverOutside()) return false;
			if (event.defaultPrevented) return true;
			if (!hasParentMenu) return true;
			if (!disclosureElement) return true;
			fireEvent(disclosureElement, "mouseout", event);
			if (!hasFocusWithin(disclosureElement)) return true;
			requestAnimationFrame(() => {
				if (hasFocusWithin(disclosureElement)) return;
				store?.hide();
			});
			return false;
		},
		modal,
		portal,
		backdrop: hasParentMenu ? false : props.backdrop
	});
	props = {
		"aria-labelledby": ariaLabelledBy,
		...props
	};
	return props;
});
/**
* Renders a dropdown menu element that's controlled by a
* [`MenuButton`](https://ariakit.com/reference/menu-button) component.
*
* This component uses the primitive
* [`MenuList`](https://ariakit.com/reference/menu-list) component under the
* hood. It renders a popover and automatically focuses on items when the menu
* is shown.
* @see https://ariakit.com/components/menu
* @example
* ```jsx {3-6}
* <MenuProvider>
*   <MenuButton>Edit</MenuButton>
*   <Menu>
*     <MenuItem>Undo</MenuItem>
*     <MenuItem>Redo</MenuItem>
*   </Menu>
* </MenuProvider>
* ```
*/
const Menu = createDialogComponent(forwardRef(function Menu(props) {
	return createElement(TagName, useMenu(props));
}), useMenuProviderContext);
//#endregion
export { Menu, useMenu };

//# sourceMappingURL=menu.js.map