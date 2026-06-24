"use client";
import { isHidden } from "../disclosure/disclosure-content.js";
import { useComposite } from "../composite/composite.js";
import { useCompositeTypeahead } from "../composite/composite-typeahead.js";
import { MenuListHiddenContext, MenuScopedContextProvider, useMenuProviderContext } from "./menu-context.js";
import { createElement, createHook, forwardRef, useEvent, useId, useMergeRefs, useWrapElement } from "@ariakit/react-utils";
import { invariant } from "@ariakit/utils";
import { useEffect, useState } from "react";
import { jsx } from "react/jsx-runtime";
import { useStoreState } from "@ariakit/react-store";
//#region src/menu/menu-list.tsx
const TagName = "div";
function useAriaLabelledBy({ store, ...props }) {
	const [id, setId] = useState(void 0);
	const label = props["aria-label"];
	const disclosureElement = useStoreState(store, "disclosureElement");
	const contentElement = useStoreState(store, "contentElement");
	useEffect(() => {
		const disclosure = disclosureElement;
		if (!disclosure) return;
		const menu = contentElement;
		if (!menu) return;
		if (label || menu.hasAttribute("aria-label")) setId(void 0);
		else if (disclosure.id) setId(disclosure.id);
	}, [
		label,
		disclosureElement,
		contentElement
	]);
	return id;
}
/**
* Returns props to create a `MenuList` component.
* @see https://ariakit.com/components/menu
* @example
* ```jsx
* const store = useMenuStore();
* const props = useMenuList({ store });
* <MenuButton store={store}>Edit</MenuButton>
* <Role {...props}>
*   <MenuItem>Undo</MenuItem>
*   <MenuItem>Redo</MenuItem>
* </Role>
* ```
*/
const useMenuList = createHook(function useMenuList({ store, alwaysVisible, composite, ...props }) {
	const context = useMenuProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "MenuList must receive a `store` prop or be wrapped in a MenuProvider component.");
	const parentMenu = store.parent;
	const parentMenubar = store.menubar;
	const hasParentMenu = !!parentMenu;
	const id = useId(props.id);
	const onKeyDownProp = props.onKeyDown;
	const dir = useStoreState(store, (state) => state.placement.split("-")[0]);
	const orientation = useStoreState(store, (state) => state.orientation === "both" ? void 0 : state.orientation);
	const isHorizontal = orientation !== "vertical";
	const isMenubarHorizontal = useStoreState(parentMenubar, (state) => !!state && state.orientation !== "vertical");
	const onKeyDown = useEvent((event) => {
		onKeyDownProp?.(event);
		if (event.defaultPrevented) return;
		if (hasParentMenu || parentMenubar && !isHorizontal) {
			const action = {
				ArrowRight: () => dir === "left" && !isHorizontal,
				ArrowLeft: () => dir === "right" && !isHorizontal,
				ArrowUp: () => dir === "bottom" && isHorizontal,
				ArrowDown: () => dir === "top" && isHorizontal
			}[event.key];
			if (action?.()) {
				event.stopPropagation();
				event.preventDefault();
				return store?.hide();
			}
		}
		if (parentMenubar) {
			const action = {
				ArrowRight: () => {
					if (!isMenubarHorizontal) return;
					return parentMenubar.next();
				},
				ArrowLeft: () => {
					if (!isMenubarHorizontal) return;
					return parentMenubar.previous();
				},
				ArrowDown: () => {
					if (isMenubarHorizontal) return;
					return parentMenubar.next();
				},
				ArrowUp: () => {
					if (isMenubarHorizontal) return;
					return parentMenubar.previous();
				}
			}[event.key];
			const id = action?.();
			if (id !== void 0) {
				event.stopPropagation();
				event.preventDefault();
				parentMenubar.move(id);
			}
		}
	});
	props = useWrapElement(props, (element) => /* @__PURE__ */ jsx(MenuScopedContextProvider, {
		value: store,
		children: element
	}), [store]);
	const ariaLabelledBy = useAriaLabelledBy({
		store,
		...props
	});
	const hidden = isHidden(useStoreState(store, "mounted"), props.hidden, alwaysVisible);
	const style = hidden ? {
		...props.style,
		display: "none"
	} : props.style;
	props = useWrapElement(props, (element) => /* @__PURE__ */ jsx(MenuListHiddenContext.Provider, {
		value: hidden,
		children: element
	}), [hidden]);
	props = {
		"aria-labelledby": ariaLabelledBy,
		hidden,
		...props,
		id,
		ref: useMergeRefs(id ? store.setContentElement : null, props.ref),
		style,
		onKeyDown
	};
	const hasCombobox = !!store.combobox;
	composite = composite ?? !hasCombobox;
	if (composite) props = {
		role: "menu",
		"aria-orientation": orientation,
		...props
	};
	props = useComposite({
		store,
		composite,
		...props
	});
	props = useCompositeTypeahead({
		store,
		typeahead: !hasCombobox,
		...props
	});
	return props;
});
/**
* Renders a menu list element. This is the primitive component used by the
* [`Menu`](https://ariakit.com/reference/menu) component.
*
* Unlike [`Menu`](https://ariakit.com/reference/menu), this component doesn't
* render a popover and therefore doesn't automatically focus on items when
* opened.
* @see https://ariakit.com/components/menu
* @example
* ```jsx {3-6}
* <MenuProvider>
*   <MenuButton>Edit</MenuButton>
*   <MenuList>
*     <MenuItem>Undo</MenuItem>
*     <MenuItem>Redo</MenuItem>
*   </MenuList>
* </MenuProvider>
* ```
*/
const MenuList = forwardRef(function MenuList(props) {
	return createElement(TagName, useMenuList(props));
});
//#endregion
export { MenuList, useMenuList };

//# sourceMappingURL=menu-list.js.map