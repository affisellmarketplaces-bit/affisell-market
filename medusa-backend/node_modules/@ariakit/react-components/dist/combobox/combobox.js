"use client";
import { useComboboxProviderContext } from "./combobox-context.js";
import { useComposite } from "../composite/composite.js";
import { usePopoverAnchor } from "../popover/popover-anchor.js";
import { createElement, createHook, forwardRef, useBooleanEvent, useEvent, useForceUpdate, useId, useMergeRefs, useSafeLayoutEffect, useUpdateEffect, useUpdateLayoutEffect } from "@ariakit/react-utils";
import { getPopupRole, getScrollingElement, getTextboxSelection, hasFocus, invariant, isFalsyBooleanCallback, isFocusEventOutside, noop, normalizeString, queueBeforeEvent, setSelectionRange } from "@ariakit/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStoreState } from "@ariakit/react-store";
import { sync } from "@ariakit/store";
//#region src/combobox/combobox.tsx
const TagName = "input";
function isFirstItemAutoSelected(items, activeValue, autoSelect) {
	if (!autoSelect) return false;
	return items.find((item) => !item.disabled && item.value)?.value === activeValue;
}
function hasCompletionString(value, activeValue) {
	if (!activeValue) return false;
	if (value == null) return false;
	value = normalizeString(value);
	return activeValue.length > value.length && activeValue.toLowerCase().indexOf(value.toLowerCase()) === 0;
}
function isInputEvent(event) {
	return event.type === "input";
}
function isAriaAutoCompleteValue(value) {
	return value === "inline" || value === "list" || value === "both" || value === "none";
}
function getDefaultAutoSelectId(items) {
	return items.find((item) => {
		if (item.disabled) return false;
		return item.element?.getAttribute("role") !== "tab";
	})?.id;
}
/**
* Returns props to create a `Combobox` component.
* @see https://ariakit.com/components/combobox
* @example
* ```jsx
* const store = useComboboxStore();
* const props = useCombobox({ store });
* <Role {...props} />
* <ComboboxPopover store={store}>
*   <ComboboxItem value="Apple" />
*   <ComboboxItem value="Banana" />
*   <ComboboxItem value="Orange" />
* </ComboboxPopover>
* ```
*/
const useCombobox = createHook(function useCombobox({ store, focusable = true, autoSelect: autoSelectProp = false, getAutoSelectId, setValueOnChange, showMinLength = 0, showOnChange, showOnMouseDown, showOnClick = showOnMouseDown, showOnKeyDown, showOnKeyPress = showOnKeyDown, blurActiveItemOnClick, setValueOnClick = true, moveOnKeyPress = true, autoComplete = "list", ...props }) {
	const context = useComboboxProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "Combobox must receive a `store` prop or be wrapped in a ComboboxProvider component.");
	const ref = useRef(null);
	const [valueUpdated, forceValueUpdate] = useForceUpdate();
	const canAutoSelectRef = useRef(false);
	const composingRef = useRef(false);
	const autoSelect = useStoreState(store, (state) => state.virtualFocus && autoSelectProp);
	const inline = autoComplete === "inline" || autoComplete === "both";
	const [canInline, setCanInline] = useState(inline);
	useUpdateLayoutEffect(() => {
		if (!inline) return;
		setCanInline(true);
	}, [inline]);
	const storeValue = useStoreState(store, "value");
	const prevSelectedValueRef = useRef(void 0);
	useEffect(() => {
		return sync(store, ["selectedValue", "activeId"], (_, prev) => {
			prevSelectedValueRef.current = prev.selectedValue;
		});
	}, [store]);
	const inlineActiveValue = useStoreState(store, (state) => {
		if (!inline) return;
		if (!canInline) return;
		if (state.activeValue && Array.isArray(state.selectedValue)) {
			if (state.selectedValue.includes(state.activeValue)) return;
			if (prevSelectedValueRef.current?.includes(state.activeValue)) return;
		}
		return state.activeValue;
	});
	const items = useStoreState(store, "renderedItems");
	const open = useStoreState(store, "open");
	const contentElement = useStoreState(store, "contentElement");
	const value = useMemo(() => {
		if (!inline) return storeValue;
		if (!canInline) return storeValue;
		if (isFirstItemAutoSelected(items, inlineActiveValue, autoSelect)) {
			if (hasCompletionString(storeValue, inlineActiveValue)) return storeValue + (inlineActiveValue?.slice(storeValue.length) || "");
			return storeValue;
		}
		return inlineActiveValue || storeValue;
	}, [
		inline,
		canInline,
		items,
		inlineActiveValue,
		autoSelect,
		storeValue
	]);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const onCompositeItemMove = () => setCanInline(true);
		element.addEventListener("combobox-item-move", onCompositeItemMove);
		return () => {
			element.removeEventListener("combobox-item-move", onCompositeItemMove);
		};
	}, []);
	useEffect(() => {
		if (!inline) return;
		if (!canInline) return;
		if (!inlineActiveValue) return;
		if (!isFirstItemAutoSelected(items, inlineActiveValue, autoSelect)) return;
		if (!hasCompletionString(storeValue, inlineActiveValue)) return;
		let cleanup = noop;
		queueMicrotask(() => {
			const element = ref.current;
			if (!element) return;
			const { start: prevStart, end: prevEnd } = getTextboxSelection(element);
			const nextStart = storeValue.length;
			const nextEnd = inlineActiveValue.length;
			setSelectionRange(element, nextStart, nextEnd);
			cleanup = () => {
				if (!hasFocus(element)) return;
				const { start, end } = getTextboxSelection(element);
				if (start !== nextStart) return;
				if (end !== nextEnd) return;
				setSelectionRange(element, prevStart, prevEnd);
			};
		});
		return () => cleanup();
	}, [
		valueUpdated,
		inline,
		canInline,
		inlineActiveValue,
		items,
		autoSelect,
		storeValue
	]);
	const scrollingElementRef = useRef(null);
	const getAutoSelectIdProp = useEvent(getAutoSelectId);
	const autoSelectIdRef = useRef(null);
	const autoSelectMovedRef = useRef(void 0);
	const userScrolledRef = useRef(false);
	const isAutoScrollingRef = useRef(false);
	useEffect(() => {
		if (!open) return;
		if (!contentElement) return;
		const scrollingElement = getScrollingElement(contentElement);
		if (!scrollingElement) return;
		scrollingElementRef.current = scrollingElement;
		const onUserScroll = () => {
			canAutoSelectRef.current = false;
			userScrolledRef.current = true;
		};
		const onScroll = () => {
			if (!isAutoScrollingRef.current) userScrolledRef.current = true;
			if (!store) return;
			if (!canAutoSelectRef.current) return;
			const { activeId } = store.getState();
			if (activeId === null) return;
			if (activeId === autoSelectIdRef.current) return;
			canAutoSelectRef.current = false;
		};
		const options = {
			passive: true,
			capture: true
		};
		scrollingElement.addEventListener("wheel", onUserScroll, options);
		scrollingElement.addEventListener("touchmove", onUserScroll, options);
		scrollingElement.addEventListener("scroll", onScroll, options);
		return () => {
			scrollingElement.removeEventListener("wheel", onUserScroll, true);
			scrollingElement.removeEventListener("touchmove", onUserScroll, true);
			scrollingElement.removeEventListener("scroll", onScroll, true);
		};
	}, [
		open,
		contentElement,
		store
	]);
	useSafeLayoutEffect(() => {
		userScrolledRef.current = false;
		if (!storeValue) return;
		if (composingRef.current) return;
		canAutoSelectRef.current = true;
	}, [storeValue]);
	useSafeLayoutEffect(() => {
		if (autoSelect !== "always" && open) return;
		canAutoSelectRef.current = open;
	}, [autoSelect, open]);
	useSafeLayoutEffect(() => {
		if (open) return;
		autoSelectMovedRef.current = void 0;
	}, [open]);
	const resetValueOnSelect = useStoreState(store, "resetValueOnSelect");
	useUpdateEffect(() => {
		const canAutoSelect = canAutoSelectRef.current;
		if (!store) return;
		if (!open) return;
		if (!canAutoSelect && (!resetValueOnSelect || userScrolledRef.current)) return;
		const { baseElement, contentElement, activeId } = store.getState();
		if (baseElement && !hasFocus(baseElement)) return;
		if (contentElement?.hasAttribute("data-placing")) {
			const observer = new MutationObserver(forceValueUpdate);
			observer.observe(contentElement, { attributeFilter: ["data-placing"] });
			return () => observer.disconnect();
		}
		if (autoSelect && canAutoSelect) {
			const userAutoSelectId = getAutoSelectIdProp(items);
			const autoSelectId = userAutoSelectId !== void 0 ? userAutoSelectId : getDefaultAutoSelectId(items) ?? store.first();
			autoSelectIdRef.current = autoSelectId;
			const nextActiveId = autoSelectId ?? null;
			const nextActiveValue = store.item(nextActiveId)?.value;
			const moved = autoSelectMovedRef.current;
			if (nextActiveId !== activeId || moved?.id !== nextActiveId || moved?.value !== nextActiveValue) {
				autoSelectMovedRef.current = {
					id: nextActiveId,
					value: nextActiveValue
				};
				store.move(nextActiveId);
			} else store.setState("activeValue", nextActiveValue);
		} else {
			const element = store.item(activeId || store.first())?.element;
			if (element && "scrollIntoView" in element) {
				isAutoScrollingRef.current = true;
				element.scrollIntoView({
					block: "nearest",
					inline: "nearest"
				});
				requestAnimationFrame(() => {
					isAutoScrollingRef.current = false;
				});
			}
		}
	}, [
		store,
		open,
		valueUpdated,
		storeValue,
		autoSelect,
		resetValueOnSelect,
		getAutoSelectIdProp,
		items
	]);
	useEffect(() => {
		if (!inline) return;
		const combobox = ref.current;
		if (!combobox) return;
		const elements = [combobox, contentElement].filter((value) => !!value);
		const onBlur = (event) => {
			if (elements.every((el) => isFocusEventOutside(event, el))) store?.setValue(value);
		};
		for (const element of elements) element.addEventListener("focusout", onBlur);
		return () => {
			for (const element of elements) element.removeEventListener("focusout", onBlur);
		};
	}, [
		inline,
		contentElement,
		store,
		value
	]);
	const canShow = (event) => {
		return event.currentTarget.value.length >= showMinLength;
	};
	const onChangeProp = props.onChange;
	const showOnChangeProp = useBooleanEvent(showOnChange ?? canShow);
	const setValueOnChangeProp = useBooleanEvent(setValueOnChange ?? !store.tag);
	const onChange = useEvent((event) => {
		onChangeProp?.(event);
		if (event.defaultPrevented) return;
		if (!store) return;
		const currentTarget = event.currentTarget;
		const { value, selectionStart, selectionEnd } = currentTarget;
		const nativeEvent = event.nativeEvent;
		canAutoSelectRef.current = true;
		if (isInputEvent(nativeEvent)) {
			if (nativeEvent.isComposing) {
				canAutoSelectRef.current = false;
				composingRef.current = true;
			}
			if (inline) {
				const textInserted = nativeEvent.inputType === "insertText" || nativeEvent.inputType === "insertCompositionText";
				const caretAtEnd = selectionStart === value.length;
				setCanInline(textInserted && caretAtEnd);
			}
		}
		if (setValueOnChangeProp(event)) {
			const isSameValue = value === store.getState().value;
			store.setValue(value);
			queueMicrotask(() => {
				setSelectionRange(currentTarget, selectionStart, selectionEnd);
			});
			if (inline && autoSelect && isSameValue) forceValueUpdate();
		}
		if (showOnChangeProp(event)) store.show();
		if (!autoSelect || !canAutoSelectRef.current) store.setActiveId(null);
	});
	const onCompositionEndProp = props.onCompositionEnd;
	const onCompositionEnd = useEvent((event) => {
		canAutoSelectRef.current = true;
		composingRef.current = false;
		onCompositionEndProp?.(event);
		if (event.defaultPrevented) return;
		if (!autoSelect) return;
		forceValueUpdate();
	});
	const onMouseDownProp = props.onMouseDown;
	const blurActiveItemOnClickProp = useBooleanEvent(blurActiveItemOnClick ?? (() => store.getState().includesBaseElement));
	const setValueOnClickProp = useBooleanEvent(setValueOnClick);
	const showOnClickProp = useBooleanEvent(showOnClick ?? canShow);
	const onMouseDown = useEvent((event) => {
		onMouseDownProp?.(event);
		if (event.defaultPrevented) return;
		if (event.button) return;
		if (event.ctrlKey) return;
		if (!store) return;
		if (blurActiveItemOnClickProp(event)) store.setActiveId(null);
		if (setValueOnClickProp(event)) store.setValue(value);
		if (showOnClickProp(event)) queueBeforeEvent(event.currentTarget, "mouseup", store.show);
	});
	const onKeyDownProp = props.onKeyDown;
	const showOnKeyPressProp = useBooleanEvent(showOnKeyPress ?? canShow);
	const onKeyDown = useEvent((event) => {
		onKeyDownProp?.(event);
		if (!event.repeat) canAutoSelectRef.current = false;
		if (event.defaultPrevented) return;
		if (!store) return;
		const { open } = store.getState();
		if (open && event.key === "Enter") {
			event.preventDefault();
			return;
		}
		if (event.ctrlKey) return;
		if (event.altKey) return;
		if (event.shiftKey) return;
		if (event.metaKey) return;
		if (open) return;
		if (event.key === "ArrowUp" || event.key === "ArrowDown") {
			if (showOnKeyPressProp(event)) {
				event.preventDefault();
				store.show();
			}
		}
	});
	const onBlurProp = props.onBlur;
	const onBlur = useEvent((event) => {
		canAutoSelectRef.current = false;
		onBlurProp?.(event);
		if (event.defaultPrevented) return;
	});
	const id = useId(props.id);
	const ariaAutoComplete = isAriaAutoCompleteValue(autoComplete) ? autoComplete : void 0;
	const isActiveItem = useStoreState(store, (state) => state.activeId === null);
	props = {
		role: "combobox",
		"aria-autocomplete": ariaAutoComplete,
		"aria-haspopup": getPopupRole(contentElement, "listbox"),
		"aria-expanded": open,
		"aria-controls": contentElement?.id,
		"data-active-item": isActiveItem || void 0,
		value,
		...props,
		id,
		ref: useMergeRefs(ref, props.ref),
		onChange,
		onCompositionEnd,
		onMouseDown,
		onKeyDown,
		onBlur
	};
	props = useComposite({
		store,
		focusable,
		...props,
		moveOnKeyPress: (event) => {
			if (isFalsyBooleanCallback(moveOnKeyPress, event)) return false;
			if (inline) setCanInline(true);
			return true;
		}
	});
	props = usePopoverAnchor({
		store,
		...props
	});
	return {
		autoComplete: "off",
		...props
	};
});
/**
* Renders a combobox input element that can be used to filter a list of items.
* @see https://ariakit.com/components/combobox
* @example
* ```jsx {2}
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
const Combobox = forwardRef(function Combobox(props) {
	return createElement(TagName, useCombobox(props));
});
//#endregion
export { Combobox, useCombobox };

//# sourceMappingURL=combobox.js.map