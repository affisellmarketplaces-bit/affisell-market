"use client";
import { useFocusable } from "../focusable/focusable.js";
import { CompositeScopedContextProvider, useCompositeProviderContext } from "./composite-context.js";
import { findFirstEnabledItem, getEnabledItem, groupItemsByRows, isItem, silentlyFocused } from "./utils.js";
import { createElement, createHook, forwardRef, useBooleanEvent, useEvent, useMergeRefs, useSafeLayoutEffect, useTransactionState, useWrapElement } from "@ariakit/react-utils";
import { fireBlurEvent, fireKeyboardEvent, flatten2DArray, focusIntoView, getActiveElement, hasFocus, invariant, isSelfTarget, isTextField, reverseArray } from "@ariakit/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
import { useStoreState } from "@ariakit/react-store";
//#region src/composite/composite.tsx
const TagName = "div";
function isGrid(items) {
	return items.some((item) => !!item.rowId);
}
function isPrintableKey(event) {
	const target = event.target;
	if (target && !isTextField(target)) return false;
	return event.key.length === 1 && !event.ctrlKey && !event.metaKey;
}
function isModifierKey(event) {
	return event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta";
}
function useKeyboardEventProxy(store, onKeyboardEvent, previousElementRef) {
	return useEvent((event) => {
		onKeyboardEvent?.(event);
		if (event.defaultPrevented) return;
		if (event.isPropagationStopped()) return;
		if (!isSelfTarget(event)) return;
		if (isModifierKey(event)) return;
		if (isPrintableKey(event)) return;
		const activeElement = getEnabledItem(store, store.getState().activeId)?.element;
		if (!activeElement) return;
		const { view, ...eventInit } = event;
		if (activeElement !== previousElementRef?.current) activeElement.focus();
		if (!fireKeyboardEvent(activeElement, event.type, eventInit)) event.preventDefault();
		if (event.currentTarget.contains(activeElement)) event.stopPropagation();
	});
}
function findFirstEnabledItemInTheLastRow(items) {
	return findFirstEnabledItem(flatten2DArray(reverseArray(groupItemsByRows(items))));
}
function withBaseScrollPreserved(store, callback) {
	const { virtualFocus, baseElement } = store.getState();
	if (!virtualFocus || !baseElement || !isTextField(baseElement)) {
		callback();
		return;
	}
	const savedScrollLeft = baseElement.scrollLeft;
	const savedScrollTop = baseElement.scrollTop;
	callback();
	baseElement.scrollLeft = savedScrollLeft;
	baseElement.scrollTop = savedScrollTop;
}
function useScheduleFocus(store) {
	const [scheduled, setScheduled] = useState(false);
	const schedule = useCallback(() => setScheduled(true), []);
	const activeItem = useStoreState(store, (state) => getEnabledItem(store, state.activeId));
	useEffect(() => {
		const activeElement = activeItem?.element;
		if (!scheduled) return;
		if (!activeElement) return;
		setScheduled(false);
		withBaseScrollPreserved(store, () => {
			activeElement.focus({ preventScroll: true });
		});
	}, [
		store,
		activeItem,
		scheduled
	]);
	return schedule;
}
/**
* Returns props to create a `Composite` component.
* @see https://ariakit.com/components/composite
* @example
* ```jsx
* const store = useCompositeStore();
* const props = useComposite({ store });
* <Role {...props}>
*   <CompositeItem>Item 1</CompositeItem>
*   <CompositeItem>Item 2</CompositeItem>
* </Role>
* ```
*/
const useComposite = createHook(function useComposite({ store, composite = true, focusOnMove = composite, moveOnKeyPress = true, ...props }) {
	const context = useCompositeProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "Composite must receive a `store` prop or be wrapped in a CompositeProvider component.");
	const ref = useRef(null);
	const previousElementRef = useRef(null);
	const scheduleFocus = useScheduleFocus(store);
	const moves = useStoreState(store, "moves");
	const [, setBaseElement] = useTransactionState(composite ? store.setBaseElement : null);
	useEffect(() => {
		if (!store) return;
		if (!moves) return;
		if (!composite) return;
		if (!focusOnMove) return;
		const { activeId } = store.getState();
		const itemElement = getEnabledItem(store, activeId)?.element;
		if (!itemElement) return;
		withBaseScrollPreserved(store, () => focusIntoView(itemElement));
	}, [
		store,
		moves,
		composite,
		focusOnMove
	]);
	useSafeLayoutEffect(() => {
		if (!store) return;
		if (!moves) return;
		if (!composite) return;
		const { baseElement, activeId } = store.getState();
		if (!(activeId === null)) return;
		if (!baseElement) return;
		const previousElement = previousElementRef.current;
		previousElementRef.current = null;
		if (previousElement) fireBlurEvent(previousElement, { relatedTarget: baseElement });
		if (!hasFocus(baseElement)) baseElement.focus();
	}, [
		store,
		moves,
		composite
	]);
	const activeId = useStoreState(store, "activeId");
	const virtualFocus = useStoreState(store, "virtualFocus");
	useSafeLayoutEffect(() => {
		if (!store) return;
		if (!composite) return;
		if (!virtualFocus) return;
		const previousElement = previousElementRef.current;
		previousElementRef.current = null;
		if (!previousElement) return;
		const relatedTarget = getEnabledItem(store, activeId)?.element || getActiveElement(previousElement);
		if (relatedTarget === previousElement) return;
		fireBlurEvent(previousElement, { relatedTarget });
	}, [
		store,
		activeId,
		virtualFocus,
		composite
	]);
	const onKeyDownCapture = useKeyboardEventProxy(store, props.onKeyDownCapture, previousElementRef);
	const onKeyUpCapture = useKeyboardEventProxy(store, props.onKeyUpCapture, previousElementRef);
	const onFocusCaptureProp = props.onFocusCapture;
	const onFocusCapture = useEvent((event) => {
		onFocusCaptureProp?.(event);
		if (event.defaultPrevented) return;
		if (!store) return;
		const { virtualFocus } = store.getState();
		if (!virtualFocus) return;
		const previousActiveElement = event.relatedTarget;
		const isSilentlyFocused = silentlyFocused(event.currentTarget);
		if (isSelfTarget(event) && isSilentlyFocused) {
			event.stopPropagation();
			previousElementRef.current = previousActiveElement;
		}
	});
	const onFocusProp = props.onFocus;
	const onFocus = useEvent((event) => {
		onFocusProp?.(event);
		if (event.defaultPrevented) return;
		if (!composite) return;
		if (!store) return;
		const { relatedTarget } = event;
		const { virtualFocus } = store.getState();
		if (virtualFocus) {
			if (isSelfTarget(event) && !isItem(store, relatedTarget)) queueMicrotask(scheduleFocus);
		} else if (isSelfTarget(event)) store.setActiveId(null);
	});
	const onBlurCaptureProp = props.onBlurCapture;
	const onBlurCapture = useEvent((event) => {
		onBlurCaptureProp?.(event);
		if (event.defaultPrevented) return;
		if (!store) return;
		const { virtualFocus, activeId } = store.getState();
		if (!virtualFocus) return;
		const activeElement = getEnabledItem(store, activeId)?.element;
		const nextActiveElement = event.relatedTarget;
		const nextActiveElementIsItem = isItem(store, nextActiveElement);
		const previousElement = previousElementRef.current;
		previousElementRef.current = null;
		if (isSelfTarget(event) && nextActiveElementIsItem) {
			if (nextActiveElement === activeElement) {
				if (previousElement && previousElement !== nextActiveElement) fireBlurEvent(previousElement, event);
			} else if (activeElement) fireBlurEvent(activeElement, event);
			else if (previousElement) fireBlurEvent(previousElement, event);
			event.stopPropagation();
		} else if (!isItem(store, event.target) && activeElement) fireBlurEvent(activeElement, event);
	});
	const onKeyDownProp = props.onKeyDown;
	const moveOnKeyPressProp = useBooleanEvent(moveOnKeyPress);
	const onKeyDown = useEvent((event) => {
		onKeyDownProp?.(event);
		if (event.nativeEvent.isComposing) return;
		if (event.defaultPrevented) return;
		if (!store) return;
		if (!isSelfTarget(event)) return;
		const { orientation, renderedItems, activeId } = store.getState();
		if (getEnabledItem(store, activeId)?.element?.isConnected) return;
		const isVertical = orientation !== "horizontal";
		const isHorizontal = orientation !== "vertical";
		const grid = isGrid(renderedItems);
		if ((event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") && isTextField(event.currentTarget)) return;
		const up = () => {
			if (grid) return findFirstEnabledItemInTheLastRow(renderedItems)?.id;
			return store?.last();
		};
		const action = {
			ArrowUp: (grid || isVertical) && up,
			ArrowRight: (grid || isHorizontal) && store.first,
			ArrowDown: (grid || isVertical) && store.first,
			ArrowLeft: (grid || isHorizontal) && store.last,
			Home: store.first,
			End: store.last,
			PageUp: store.first,
			PageDown: store.last
		}[event.key];
		if (action) {
			const id = action();
			if (id !== void 0) {
				if (!moveOnKeyPressProp(event)) return;
				event.preventDefault();
				store.move(id);
			}
		}
	});
	props = useWrapElement(props, (element) => /* @__PURE__ */ jsx(CompositeScopedContextProvider, {
		value: store,
		children: element
	}), [store]);
	props = {
		"aria-activedescendant": useStoreState(store, (state) => {
			if (!store) return;
			if (!composite) return;
			if (!state.virtualFocus) return;
			return getEnabledItem(store, state.activeId)?.id;
		}),
		...props,
		ref: useMergeRefs(ref, setBaseElement, props.ref),
		onKeyDownCapture,
		onKeyUpCapture,
		onFocusCapture,
		onFocus,
		onBlurCapture,
		onKeyDown
	};
	props = useFocusable({
		focusable: useStoreState(store, (state) => composite && (state.virtualFocus || state.activeId === null)),
		...props
	});
	return props;
});
/**
* Renders a composite widget.
* @see https://ariakit.com/components/composite
* @example
* ```jsx
* const composite = useCompositeStore();
* <Composite store={composite}>
*   <CompositeItem>Item 1</CompositeItem>
*   <CompositeItem>Item 2</CompositeItem>
* </Composite>
* ```
*/
const Composite = forwardRef(function Composite(props) {
	return createElement(TagName, useComposite(props));
});
//#endregion
export { Composite, useComposite };

//# sourceMappingURL=composite.js.map