"use client";
import { useCommand } from "../command/command.js";
import { useCollectionItem } from "../collection/collection-item.js";
import { CompositeItemContext, CompositeRowContext, useCompositeScopedContext } from "./composite-context.js";
import { focusSilently, getEnabledItem, isItem, selectTextField } from "./utils.js";
import { createElement, createHook, forwardRef, memo, useBooleanEvent, useEvent, useId, useMergeRefs, useWrapElement } from "@ariakit/react-utils";
import { disabledFromProps, getScrollingElement, getTextboxSelection, getTextboxValue, isButton, isPortalEvent, isSafari, isSelfTarget, isTextField, isTextbox, removeUndefinedValues } from "@ariakit/utils";
import { useCallback, useContext, useMemo, useRef } from "react";
import { jsx } from "react/jsx-runtime";
import { useStoreStateObject } from "@ariakit/react-store";
//#region src/composite/composite-item.tsx
const TagName = "button";
function isEditableElement(element) {
	if (isTextbox(element)) return true;
	return element.tagName === "INPUT" && !isButton(element);
}
function getNextPageOffset(scrollingElement, pageUp = false) {
	const height = scrollingElement.clientHeight;
	const { top } = scrollingElement.getBoundingClientRect();
	const pageSize = Math.max(height * .875, height - 40) * 1.5;
	const pageOffset = pageUp ? height - pageSize + top : pageSize + top;
	if (scrollingElement.tagName === "HTML") return pageOffset + scrollingElement.scrollTop;
	return pageOffset;
}
function getItemOffset(itemElement, pageUp = false) {
	const { top } = itemElement.getBoundingClientRect();
	if (pageUp) return top + itemElement.clientHeight;
	return top;
}
function findNextPageItemId(element, store, next, pageUp = false) {
	if (!store) return;
	if (!next) return;
	const { renderedItems } = store.getState();
	const scrollingElement = getScrollingElement(element);
	if (!scrollingElement) return;
	const nextPageOffset = getNextPageOffset(scrollingElement, pageUp);
	let id;
	let prevDifference;
	for (let i = 0; i < renderedItems.length; i += 1) {
		const previousId = id;
		id = next(i);
		if (!id) break;
		if (id === previousId) continue;
		const itemElement = getEnabledItem(store, id)?.element;
		if (!itemElement) continue;
		const difference = getItemOffset(itemElement, pageUp) - nextPageOffset;
		const absDifference = Math.abs(difference);
		if (pageUp && difference <= 0 || !pageUp && difference >= 0) {
			if (prevDifference !== void 0 && prevDifference < absDifference) id = previousId;
			break;
		}
		prevDifference = absDifference;
	}
	return id;
}
function targetIsAnotherItem(event, store) {
	if (isSelfTarget(event)) return false;
	return isItem(store, event.target);
}
/**
* Returns props to create a `CompositeItem` component.
* @see https://ariakit.com/components/composite
* @example
* ```jsx
* const store = useCompositeStore();
* const props = useCompositeItem({ store });
* <Role {...props}>Item 1</Role>
* ```
*/
const useCompositeItem = createHook(function useCompositeItem({ store, rowId: rowIdProp, preventScrollOnKeyDown = false, moveOnKeyPress = true, tabbable = false, getItem: getItemProp, "aria-setsize": ariaSetSizeProp, "aria-posinset": ariaPosInSetProp, ...props }) {
	const context = useCompositeScopedContext();
	store = store || context;
	const id = useId(props.id);
	const ref = useRef(null);
	const row = useContext(CompositeRowContext);
	const trulyDisabled = disabledFromProps(props) && !props.accessibleWhenDisabled;
	const { rowId, baseElement, isActiveItem, ariaSetSize, ariaPosInSet, isTabbable } = useStoreStateObject(store, {
		rowId(state) {
			if (rowIdProp) return rowIdProp;
			if (!state) return;
			if (!row?.baseElement) return;
			if (row.baseElement !== state.baseElement) return;
			return row.id;
		},
		baseElement(state) {
			return state?.baseElement || void 0;
		},
		isActiveItem(state) {
			return !!state && state.activeId === id;
		},
		ariaSetSize(state) {
			if (ariaSetSizeProp != null) return ariaSetSizeProp;
			if (!state) return;
			if (!row?.ariaSetSize) return;
			if (row.baseElement !== state.baseElement) return;
			return row.ariaSetSize;
		},
		ariaPosInSet(state) {
			if (ariaPosInSetProp != null) return ariaPosInSetProp;
			if (!state) return;
			if (!row?.ariaPosInSet) return;
			if (row.baseElement !== state.baseElement) return;
			const itemsInRow = state.renderedItems.filter((item) => item.rowId === rowId);
			return row.ariaPosInSet + itemsInRow.findIndex((item) => item.id === id);
		},
		isTabbable(state) {
			if (!state?.renderedItems.length) return true;
			if (state.virtualFocus) return false;
			if (tabbable) return true;
			if (state.activeId === null) return false;
			const item = store?.item(state.activeId);
			if (item?.disabled) return true;
			if (!item?.element) return true;
			return state.activeId === id;
		}
	});
	const getItem = useCallback((item) => {
		const nextItem = {
			...item,
			id: id || item.id,
			rowId,
			disabled: trulyDisabled,
			children: item.element?.textContent
		};
		if (getItemProp) return getItemProp(nextItem);
		return nextItem;
	}, [
		id,
		rowId,
		trulyDisabled,
		getItemProp
	]);
	const onFocusProp = props.onFocus;
	const hasFocusedComposite = useRef(false);
	const onFocus = useEvent((event) => {
		onFocusProp?.(event);
		if (event.defaultPrevented) return;
		if (isPortalEvent(event)) return;
		if (!id) return;
		if (!store) return;
		if (targetIsAnotherItem(event, store)) return;
		const { virtualFocus, baseElement } = store.getState();
		store.setActiveId(id);
		if (isTextbox(event.currentTarget)) selectTextField(event.currentTarget);
		if (!virtualFocus) return;
		if (!isSelfTarget(event)) return;
		if (isEditableElement(event.currentTarget)) return;
		if (!baseElement?.isConnected) return;
		if (isSafari() && event.currentTarget.hasAttribute("data-autofocus")) event.currentTarget.scrollIntoView({
			block: "nearest",
			inline: "nearest"
		});
		hasFocusedComposite.current = true;
		if (event.relatedTarget === baseElement || isItem(store, event.relatedTarget)) focusSilently(baseElement);
		else baseElement.focus();
	});
	const onBlurCaptureProp = props.onBlurCapture;
	const onBlurCapture = useEvent((event) => {
		onBlurCaptureProp?.(event);
		if (event.defaultPrevented) return;
		if ((store?.getState())?.virtualFocus && hasFocusedComposite.current) {
			hasFocusedComposite.current = false;
			event.preventDefault();
			event.stopPropagation();
		}
	});
	const onKeyDownProp = props.onKeyDown;
	const preventScrollOnKeyDownProp = useBooleanEvent(preventScrollOnKeyDown);
	const moveOnKeyPressProp = useBooleanEvent(moveOnKeyPress);
	const onKeyDown = useEvent((event) => {
		onKeyDownProp?.(event);
		if (event.defaultPrevented) return;
		if (!isSelfTarget(event)) return;
		if (!store) return;
		const { currentTarget } = event;
		const state = store.getState();
		const isGrid = !!store.item(id)?.rowId;
		const isVertical = state.orientation !== "horizontal";
		const isHorizontal = state.orientation !== "vertical";
		const canHomeEnd = () => {
			if (isGrid) return true;
			if (isHorizontal) return true;
			if (!state.baseElement) return true;
			if (!isTextField(state.baseElement)) return true;
			return false;
		};
		const action = {
			ArrowUp: (isGrid || isVertical) && store.up,
			ArrowRight: (isGrid || isHorizontal) && store.next,
			ArrowDown: (isGrid || isVertical) && store.down,
			ArrowLeft: (isGrid || isHorizontal) && store.previous,
			Home: () => {
				if (!canHomeEnd()) return;
				if (!isGrid || event.ctrlKey) return store?.first();
				return store?.previous(-1);
			},
			End: () => {
				if (!canHomeEnd()) return;
				if (!isGrid || event.ctrlKey) return store?.last();
				return store?.next(-1);
			},
			PageUp: () => {
				return findNextPageItemId(currentTarget, store, store?.up, true);
			},
			PageDown: () => {
				return findNextPageItemId(currentTarget, store, store?.down);
			}
		}[event.key];
		if (action) {
			if (isTextbox(currentTarget)) {
				const selection = getTextboxSelection(currentTarget);
				const isLeft = isHorizontal && event.key === "ArrowLeft";
				const isRight = isHorizontal && event.key === "ArrowRight";
				const isUp = isVertical && event.key === "ArrowUp";
				const isDown = isVertical && event.key === "ArrowDown";
				if (isRight || isDown) {
					const { length: valueLength } = getTextboxValue(currentTarget);
					if (selection.end !== valueLength) return;
				} else if ((isLeft || isUp) && selection.start !== 0) return;
			}
			const nextId = action();
			if (preventScrollOnKeyDownProp(event) || nextId !== void 0) {
				if (!moveOnKeyPressProp(event)) return;
				event.preventDefault();
				store.move(nextId);
			}
		}
	});
	const providerValue = useMemo(() => ({
		id,
		baseElement
	}), [id, baseElement]);
	props = useWrapElement(props, (element) => /* @__PURE__ */ jsx(CompositeItemContext.Provider, {
		value: providerValue,
		children: element
	}), [providerValue]);
	props = {
		"data-active-item": isActiveItem || void 0,
		...props,
		id,
		ref: useMergeRefs(ref, props.ref),
		tabIndex: isTabbable ? props.tabIndex : -1,
		onFocus,
		onBlurCapture,
		onKeyDown
	};
	props = useCommand(props);
	props = useCollectionItem({
		store,
		...props,
		getItem,
		shouldRegisterItem: id ? props.shouldRegisterItem : false
	});
	return removeUndefinedValues({
		...props,
		"aria-setsize": ariaSetSize,
		"aria-posinset": ariaPosInSet
	});
});
/**
* Renders a focusable item as part of a composite widget. The `tabindex`
* attribute is automatically managed by this component based on the
* [`virtualFocus`](https://ariakit.com/reference/composite-provider#virtualfocus)
* option.
*
* When this component receives DOM focus or is virtually focused (when the
* [`virtualFocus`](https://ariakit.com/reference/composite-provider#virtualfocus)
* option is set to `true`), the element will automatically receive the
* [`data-active-item`](https://ariakit.com/guide/styling#data-active-item)
* attribute. This can be used to style the focused item, no matter the focus
* approach employed.
* @see https://ariakit.com/components/composite
* @example
* ```jsx {3-5}
* <CompositeProvider>
*   <Composite>
*     <CompositeItem>Item 1</CompositeItem>
*     <CompositeItem>Item 2</CompositeItem>
*     <CompositeItem>Item 3</CompositeItem>
*   </Composite>
* </CompositeProvider>
* ```
*/
const CompositeItem = memo(forwardRef(function CompositeItem(props) {
	return createElement(TagName, useCompositeItem(props));
}));
//#endregion
export { CompositeItem, useCompositeItem };

//# sourceMappingURL=composite-item.js.map