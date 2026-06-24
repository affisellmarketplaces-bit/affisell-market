"use client";
import { useFocusable } from "../focusable/focusable.js";
import { useHovercardProviderContext } from "./hovercard-context.js";
import { createElement, createHook, forwardRef, useBooleanEvent, useEvent, useIsMouseMoving, useMergeRefs } from "@ariakit/react-utils";
import { addGlobalEventListener, disabledFromProps, invariant } from "@ariakit/utils";
import { useCallback, useEffect, useRef } from "react";
//#region src/hovercard/hovercard-anchor.tsx
const TagName = "a";
/**
* Returns props to create a `HovercardAnchor` component.
* @see https://ariakit.com/components/hovercard
* @example
* ```jsx
* const store = useHovercardStore();
* const props = useHovercardAnchor({ store });
* <Role {...props} render={<a />}>@username</Role>
* <Hovercard store={store}>Details</Hovercard>
* ```
*/
const useHovercardAnchor = createHook(function useHovercardAnchor({ store, showOnHover = true, ...props }) {
	const context = useHovercardProviderContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "HovercardAnchor must receive a `store` prop or be wrapped in a HovercardProvider component.");
	const disabled = disabledFromProps(props);
	const showTimeoutRef = useRef(0);
	useEffect(() => () => window.clearTimeout(showTimeoutRef.current), []);
	useEffect(() => {
		const onMouseLeave = (event) => {
			if (!store) return;
			const { anchorElement } = store.getState();
			if (!anchorElement) return;
			if (event.target !== anchorElement) return;
			window.clearTimeout(showTimeoutRef.current);
			showTimeoutRef.current = 0;
		};
		return addGlobalEventListener("mouseleave", onMouseLeave, true);
	}, [store]);
	const onMouseMoveProp = props.onMouseMove;
	const showOnHoverProp = useBooleanEvent(showOnHover);
	const isMouseMoving = useIsMouseMoving();
	const onMouseMove = useEvent((event) => {
		onMouseMoveProp?.(event);
		if (disabled) return;
		if (!store) return;
		if (event.defaultPrevented) return;
		if (showTimeoutRef.current) return;
		if (!isMouseMoving()) return;
		if (!showOnHoverProp(event)) return;
		const element = event.currentTarget;
		store.setAnchorElement(element);
		store.setDisclosureElement(element);
		const { showTimeout, timeout } = store.getState();
		const showHovercard = () => {
			showTimeoutRef.current = 0;
			if (!isMouseMoving()) return;
			store?.setAnchorElement(element);
			store?.show();
			queueMicrotask(() => {
				store?.setDisclosureElement(element);
			});
		};
		const timeoutMs = showTimeout ?? timeout;
		if (timeoutMs === 0) showHovercard();
		else showTimeoutRef.current = window.setTimeout(showHovercard, timeoutMs);
	});
	const onClickProp = props.onClick;
	const onClick = useEvent((event) => {
		onClickProp?.(event);
		if (!store) return;
		window.clearTimeout(showTimeoutRef.current);
		showTimeoutRef.current = 0;
	});
	const ref = useCallback((element) => {
		if (!store) return;
		const { anchorElement } = store.getState();
		if (anchorElement?.isConnected) return;
		store.setAnchorElement(element);
	}, [store]);
	props = {
		...props,
		ref: useMergeRefs(ref, props.ref),
		onMouseMove,
		onClick
	};
	props = useFocusable(props);
	return props;
});
/**
* Renders an anchor element that will open a
* [`Hovercard`](https://ariakit.com/reference/hovercard) popup on hover.
* @see https://ariakit.com/components/hovercard
* @example
* ```jsx {2}
* <HovercardProvider>
*   <HovercardAnchor>@username</HovercardAnchor>
*   <Hovercard>Details</Hovercard>
* </HovercardProvider>
* ```
*/
const HovercardAnchor = forwardRef(function HovercardAnchor(props) {
	return createElement(TagName, useHovercardAnchor(props));
});
//#endregion
export { HovercardAnchor, useHovercardAnchor };

//# sourceMappingURL=hovercard-anchor.js.map