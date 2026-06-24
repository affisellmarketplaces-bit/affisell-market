"use client";
import { TagScopedContextProvider, useTagProviderContext } from "./tag-context.js";
import { useComposite } from "../composite/composite.js";
import { useTouchDevice } from "./utils.js";
import { createElement, createHook, forwardRef, useEvent, useWrapElement } from "@ariakit/react-utils";
import { UndoManager, getClosestFocusable, invariant, isApple, queueBeforeEvent } from "@ariakit/utils";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useStoreState } from "@ariakit/react-store";
//#region src/tag/tag-list.tsx
const TagName = "div";
/**
* Returns props to create a `TagList` component.
* @see https://ariakit.com/components/tag
* @example
* ```jsx
* const props = useTagList();
* <Role.div {...props} />
* ```
*/
const useTagList = createHook(function useTagList({ store, ...props }) {
	const context = useTagProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "TagList must receive a `store` prop or be wrapped in a TagProvider component.");
	const onMouseDownProp = props.onMouseDown;
	const onMouseDown = useEvent((event) => {
		onMouseDownProp?.(event);
		if (event.defaultPrevented) return;
		const target = event.target;
		const currentTarget = event.currentTarget;
		const focusableTarget = getClosestFocusable(target);
		if (!(focusableTarget === currentTarget) && currentTarget.contains(focusableTarget)) return;
		const { inputElement } = store.getState();
		queueBeforeEvent(event.currentTarget, "mouseup", () => {
			inputElement?.focus();
		});
	});
	const onKeyDownProp = props.onKeyDown;
	const onKeyDown = useEvent((event) => {
		onKeyDownProp?.(event);
		if (event.defaultPrevented) return;
		const pc = !isApple();
		const z = event.key === "z" || event.key === "Z";
		const mod = pc ? event.ctrlKey : event.metaKey;
		const shiftZ = event.shiftKey && z || pc && event.key === "y";
		if (mod && shiftZ) {
			event.preventDefault();
			UndoManager.redo();
		} else if (mod && z) {
			event.preventDefault();
			UndoManager.undo();
		}
	});
	props = useWrapElement(props, (element) => /* @__PURE__ */ jsx(TagScopedContextProvider, {
		value: store,
		children: element
	}), [store]);
	props = {
		...props,
		onMouseDown,
		onKeyDown
	};
	props = useComposite({
		store,
		...props
	});
	const orientation = useStoreState(store, (state) => state.orientation === "both" ? void 0 : state.orientation);
	const itemIds = useStoreState(store, (state) => state.renderedItems).filter((item) => !!item.value).map((item) => item.id);
	const labelId = useStoreState(store, (state) => state.labelElement?.id);
	const listboxProps = {};
	for (const key in props) if (key === "role" || key.startsWith("aria-")) {
		const prop = key;
		listboxProps[prop] = props[prop];
		delete props[prop];
	}
	const children = /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		role: useTouchDevice() ? "list" : "listbox",
		"aria-live": "polite",
		"aria-relevant": "all",
		"aria-atomic": true,
		"aria-labelledby": listboxProps["aria-label"] != null ? void 0 : labelId,
		"aria-orientation": orientation,
		"aria-owns": itemIds.join(" "),
		...listboxProps,
		style: { position: "fixed" }
	}), props.children] });
	props = {
		...props,
		children
	};
	return props;
});
/**
* Renders a wrapper for [`Tag`](https://ariakit.com/reference/tag) and
* [`TagInput`](https://ariakit.com/reference/tag-input) components. This
* component is typically styled as an input field.
*
* The [`TagListLabel`](https://ariakit.com/reference/tag-list-label) component
* can be used to provide an accessible name for the listbox element that owns
* the tags.
* @see https://ariakit.com/components/tag
* @example
* ```jsx {3-15}
* <TagProvider>
*   <TagListLabel>Invitees</TagListLabel>
*   <TagList>
*     <TagValues>
*       {(values) =>
*         values.map((value) => (
*           <Tag key={value} value={value}>
*             {value}
*             <TagRemove />
*           </Tag>
*         ))
*       }
*     </TagValues>
*     <TagInput />
*   </TagList>
* </TagProvider>
* ```
*/
const TagList = forwardRef(function TagList(props) {
	return createElement(TagName, useTagList(props));
});
//#endregion
export { TagList, useTagList };

//# sourceMappingURL=tag-list.js.map