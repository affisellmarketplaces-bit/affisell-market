"use client";
import { Role } from "../role/role.js";
import { CollectionItem as CollectionItem$1 } from "./collection-item.js";
import { forwardRef, useForceUpdate, useId, useMergeRefs } from "@ariakit/react-utils";
import { invariant } from "@ariakit/utils";
import { useCallback, useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/collection/collection-item-offscreen.tsx
const TagName = "div";
function requestIdleCallback(callback) {
	if (typeof window.requestIdleCallback === "function") return window.requestIdleCallback(callback);
	callback();
	return 0;
}
function cancelIdleCallback(id) {
	if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(id);
}
function useCollectionItemOffscreen({ offscreenMode = "active", offscreenRoot, ...props }) {
	const id = useId(props.id);
	const [updated, forceUpdate] = useForceUpdate();
	const forcedUpdatesCountRef = useRef(0);
	const [_active, setActive] = useState(offscreenMode === "active");
	const active = _active || offscreenMode === "active";
	const observerRef = useRef(null);
	const idleCallbackIdRef = useRef(0);
	return {
		id,
		active,
		ref: useCallback((element) => {
			if (!element || offscreenMode === "active") {
				cancelIdleCallback(idleCallbackIdRef.current);
				observerRef.current?.disconnect();
				return;
			}
			invariant(offscreenRoot !== void 0, process.env.NODE_ENV !== "production" && "The offscreenRoot prop must be provided.");
			const getOffscreenRoot = () => {
				if (!offscreenRoot) return null;
				if (typeof offscreenRoot === "function") return offscreenRoot(element);
				if ("current" in offscreenRoot) return offscreenRoot.current;
				return offscreenRoot;
			};
			const root = getOffscreenRoot();
			if (!root) {
				forcedUpdatesCountRef.current++;
				if (forcedUpdatesCountRef.current > 3) throw new Error("The offscreenRoot is not available. Please make sure the root element is mounted.");
				forceUpdate();
				return;
			}
			if (!observerRef.current || observerRef.current.root !== root) observerRef.current = new IntersectionObserver(([entry]) => {
				cancelIdleCallback(idleCallbackIdRef.current);
				const isIntersecting = !!entry?.isIntersecting;
				idleCallbackIdRef.current = requestIdleCallback(() => {
					if (!isIntersecting && offscreenMode === "lazy") return;
					setActive(isIntersecting);
				});
			}, {
				root,
				rootMargin: "40%"
			});
			observerRef.current.observe(element);
		}, [
			updated,
			offscreenMode,
			offscreenRoot
		]),
		"data-offscreen": !active || void 0
	};
}
const CollectionItem = forwardRef(function CollectionItem({ offscreenMode, offscreenRoot, ...props }) {
	const { active, ref, ...rest } = useCollectionItemOffscreen({
		offscreenMode,
		offscreenRoot,
		...props
	});
	const allProps = {
		...rest,
		...props,
		ref: useMergeRefs(ref, props.ref)
	};
	if (active) return /* @__PURE__ */ jsx(CollectionItem$1, { ...allProps });
	const { store, shouldRegisterItem, getItem, element, ...htmlProps } = allProps;
	const Component = Role[TagName];
	return /* @__PURE__ */ jsx(Component, { ...htmlProps });
});
//#endregion
export { CollectionItem, useCollectionItemOffscreen };

//# sourceMappingURL=collection-item-offscreen.js.map