"use client";
import { FocusableContext } from "./focusable-context.js";
import { createElement, createHook, forwardRef, useEvent, useMergeRefs, useMetadataProps, useTagName } from "@ariakit/react-utils";
import { addGlobalEventListener, disabledFromProps, hasFocus, isElement, isFocusEventOutside, isFocusable, isSafari, isSelfTarget, queueBeforeEvent, removeUndefinedValues } from "@ariakit/utils";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
//#region src/focusable/focusable.tsx
const TagName = "div";
const accessibleWhenDisabledSymbol = Symbol("accessibleWhenDisabled");
const isSafariBrowser = isSafari();
const alwaysFocusVisibleInputTypes = [
	"text",
	"search",
	"url",
	"tel",
	"email",
	"password",
	"number",
	"date",
	"month",
	"week",
	"time",
	"datetime",
	"datetime-local"
];
function isAlwaysFocusVisible(element) {
	const { tagName, readOnly, type } = element;
	if (tagName === "TEXTAREA" && !readOnly) return true;
	if (tagName === "SELECT" && !readOnly) return true;
	if (tagName === "INPUT" && !readOnly) return alwaysFocusVisibleInputTypes.includes(type);
	if (element.isContentEditable) return true;
	if (element.getAttribute("role") === "combobox" && element.dataset.name) return true;
	return false;
}
function isNativeTabbable(tagName) {
	if (!tagName) return true;
	return tagName === "button" || tagName === "summary" || tagName === "input" || tagName === "select" || tagName === "textarea" || tagName === "a";
}
function supportsDisabledAttribute(tagName) {
	if (!tagName) return true;
	return tagName === "button" || tagName === "input" || tagName === "select" || tagName === "textarea";
}
const buttonInputTypes = [
	"button",
	"color",
	"file",
	"image",
	"reset",
	"submit"
];
function needsSafariTabIndex(tagName, inputType) {
	if (tagName === "button") return true;
	if (tagName === "input" && inputType) {
		if (inputType === "checkbox" || inputType === "radio") return true;
		return buttonInputTypes.includes(inputType);
	}
	return false;
}
function isNativeSubmitControl(element) {
	if (element.tagName === "BUTTON") {
		const { type } = element;
		return type === "submit";
	}
	if (element.tagName === "INPUT") {
		const { type } = element;
		return type === "submit" || type === "image";
	}
	return false;
}
function getTabIndex({ focusable, trulyDisabled, nativeTabbable, supportsDisabled, safariTabIndex, tabIndexProp }) {
	if (!focusable) return tabIndexProp;
	if (trulyDisabled) {
		if (nativeTabbable && !supportsDisabled) return -1;
		return;
	}
	if (nativeTabbable) {
		if (safariTabIndex && tabIndexProp == null) return 0;
		return tabIndexProp;
	}
	return tabIndexProp ?? 0;
}
function useDisableEvent(onEvent, disabled) {
	return useEvent((event) => {
		onEvent?.(event);
		if (event.defaultPrevented) return;
		if (disabled) {
			event.stopPropagation();
			event.preventDefault();
		}
	});
}
let hasInstalledGlobalEventListeners = false;
let isKeyboardModality = true;
function onGlobalMouseDown(event) {
	const target = event.target;
	if (isElement(target) && !target.hasAttribute("data-focus-visible")) isKeyboardModality = false;
}
function onGlobalKeyDown(event) {
	if (event.metaKey) return;
	if (event.ctrlKey) return;
	if (event.altKey) return;
	isKeyboardModality = true;
}
/**
* Returns props to create a `Focusable` component.
* @see https://ariakit.com/components/focusable
* @example
* ```jsx
* const props = useFocusable();
* <Role {...props}>Focusable</Role>
* ```
*/
const useFocusable = createHook(function useFocusable({ focusable = true, accessibleWhenDisabled, autoFocus, onFocusVisible, ...props }) {
	const ref = useRef(null);
	const [parentAccessibleWhenDisabled, metadataProps] = useMetadataProps(props, accessibleWhenDisabledSymbol, accessibleWhenDisabled);
	accessibleWhenDisabled ??= parentAccessibleWhenDisabled;
	useEffect(() => {
		if (!focusable) return;
		if (hasInstalledGlobalEventListeners) return;
		addGlobalEventListener("mousedown", onGlobalMouseDown, true);
		addGlobalEventListener("keydown", onGlobalKeyDown, true);
		hasInstalledGlobalEventListeners = true;
	}, [focusable]);
	const disabled = focusable && disabledFromProps(props);
	const trulyDisabled = disabled && !accessibleWhenDisabled;
	const [focusVisible, setFocusVisible] = useState(false);
	const focusVisibleRef = useRef(false);
	const nativeSubmitObserverCleanupRef = useRef(null);
	const cleanupFocusVisible = useEvent((element) => {
		nativeSubmitObserverCleanupRef.current?.();
		nativeSubmitObserverCleanupRef.current = null;
		focusVisibleRef.current = false;
		element?.removeAttribute("data-focus-visible");
	});
	useEffect(() => {
		if (!focusable) return;
		if (!trulyDisabled) return;
		cleanupFocusVisible(ref.current);
		if (focusVisible) setFocusVisible(false);
	}, [
		focusable,
		trulyDisabled,
		focusVisible,
		cleanupFocusVisible
	]);
	useEffect(() => {
		if (!focusable) return;
		if (!focusVisible) return;
		const element = ref.current;
		if (!element) return;
		if (typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver(() => {
			if (!isFocusable(element)) {
				focusVisibleRef.current = false;
				setFocusVisible(false);
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [focusable, focusVisible]);
	useEffect(() => {
		return () => nativeSubmitObserverCleanupRef.current?.();
	}, []);
	const onKeyPressCapture = useDisableEvent(props.onKeyPressCapture, disabled);
	const onMouseDownCapture = useDisableEvent(props.onMouseDownCapture, disabled);
	const onClickCapture = useDisableEvent(props.onClickCapture, disabled);
	const handleFocusVisible = (event, currentTarget) => {
		if (currentTarget) event.currentTarget = currentTarget;
		if (!focusable) return;
		const element = event.currentTarget;
		if (!element) return;
		if (!hasFocus(element)) return;
		onFocusVisible?.(event);
		if (event.defaultPrevented) return;
		element.dataset.focusVisible = "true";
		focusVisibleRef.current = true;
		if (isNativeSubmitControl(element)) {
			nativeSubmitObserverCleanupRef.current?.();
			nativeSubmitObserverCleanupRef.current = null;
			if (typeof IntersectionObserver !== "undefined") {
				const observer = new IntersectionObserver(() => {
					if (isFocusable(element)) return;
					cleanupFocusVisible(element);
				});
				observer.observe(element);
				nativeSubmitObserverCleanupRef.current = () => observer.disconnect();
			}
			return;
		}
		setFocusVisible(true);
	};
	const onKeyDownCaptureProp = props.onKeyDownCapture;
	const onKeyDownCapture = useEvent((event) => {
		onKeyDownCaptureProp?.(event);
		if (event.defaultPrevented) return;
		if (!focusable) return;
		if (focusVisible) return;
		if (focusVisibleRef.current) return;
		if (event.metaKey) return;
		if (event.altKey) return;
		if (event.ctrlKey) return;
		if (!isSelfTarget(event)) return;
		const element = event.currentTarget;
		const applyFocusVisible = () => handleFocusVisible(event, element);
		queueBeforeEvent(element, "focusout", applyFocusVisible);
	});
	const onFocusCaptureProp = props.onFocusCapture;
	const onFocusCapture = useEvent((event) => {
		onFocusCaptureProp?.(event);
		if (event.defaultPrevented) return;
		if (!focusable) return;
		if (!isSelfTarget(event)) {
			setFocusVisible(false);
			return;
		}
		const element = event.currentTarget;
		const applyFocusVisible = () => handleFocusVisible(event, element);
		if (isKeyboardModality || isAlwaysFocusVisible(event.target)) queueBeforeEvent(event.target, "focusout", applyFocusVisible);
		else setFocusVisible(false);
	});
	const onBlurProp = props.onBlur;
	const onBlur = useEvent((event) => {
		onBlurProp?.(event);
		if (!focusable) return;
		if (!isFocusEventOutside(event)) return;
		cleanupFocusVisible(event.currentTarget);
		setFocusVisible(false);
	});
	const autoFocusOnShow = useContext(FocusableContext);
	const autoFocusRef = useEvent((element) => {
		if (!focusable) return;
		if (!autoFocus) return;
		if (!element) return;
		if (!autoFocusOnShow) return;
		queueMicrotask(() => {
			if (hasFocus(element)) return;
			if (!isFocusable(element)) return;
			element.focus();
		});
	});
	const tagName = useTagName(ref);
	const nativeTabbable = focusable && isNativeTabbable(tagName);
	const supportsDisabled = focusable && supportsDisabledAttribute(tagName);
	const [safariTabIndex, setSafariTabIndex] = useState(false);
	if (isSafariBrowser) useEffect(() => {
		if (!focusable) return;
		const element = ref.current;
		if (!element) return;
		const tag = element.tagName.toLowerCase();
		const type = element.type;
		setSafariTabIndex(needsSafariTabIndex(tag, type));
	}, [focusable]);
	const styleProp = props.style;
	const style = useMemo(() => {
		if (trulyDisabled) return {
			pointerEvents: "none",
			...styleProp
		};
		return styleProp;
	}, [trulyDisabled, styleProp]);
	props = {
		"data-focus-visible": focusable && focusVisible || void 0,
		"data-autofocus": autoFocus || void 0,
		"aria-disabled": disabled || void 0,
		...props,
		...metadataProps,
		ref: useMergeRefs(ref, autoFocusRef, props.ref),
		style,
		tabIndex: getTabIndex({
			focusable,
			trulyDisabled,
			nativeTabbable,
			supportsDisabled,
			safariTabIndex,
			tabIndexProp: props.tabIndex
		}),
		disabled: supportsDisabled && trulyDisabled ? true : void 0,
		contentEditable: disabled ? void 0 : props.contentEditable,
		onKeyPressCapture,
		onClickCapture,
		onMouseDownCapture,
		onKeyDownCapture,
		onFocusCapture,
		onBlur
	};
	return removeUndefinedValues(props);
});
/**
* Renders a focusable element. When this element gains keyboard focus, it gets
* a
* [`data-focus-visible`](https://ariakit.com/guide/styling#data-focus-visible)
* attribute and triggers the
* [`onFocusVisible`](https://ariakit.com/reference/focusable#onfocusvisible)
* prop.
*
* The `Focusable` component supports the
* [`disabled`](https://ariakit.com/reference/focusable#disabled) prop for all
* elements, even those not supporting the native `disabled` attribute. Disabled
* elements using the `Focusable` component may be still accessible via keyboard
* by using the the
* [`accessibleWhenDisabled`](https://ariakit.com/reference/focusable#accessiblewhendisabled)
* prop.
* @see https://ariakit.com/components/focusable
* @example
* ```jsx
* <Focusable>Focusable</Focusable>
* ```
*/
const Focusable = forwardRef(function Focusable(props) {
	return createElement(TagName, useFocusable(props));
});
//#endregion
export { Focusable, useFocusable };

//# sourceMappingURL=focusable.js.map