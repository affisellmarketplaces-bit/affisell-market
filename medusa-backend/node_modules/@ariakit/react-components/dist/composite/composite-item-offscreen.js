"use client";
import { Role } from "../role/role.js";
import { useCollectionItemOffscreen } from "../collection/collection-item-offscreen.js";
import { useCompositeScopedContext } from "./composite-context.js";
import { CompositeItem as CompositeItem$1 } from "./composite-item.js";
import { forwardRef, useId, useMergeRefs } from "@ariakit/react-utils";
import { getPopupItemRole } from "@ariakit/utils";
import { jsx } from "react/jsx-runtime";
import { useStoreStateObject } from "@ariakit/react-store";
//#region src/composite/composite-item-offscreen.tsx
const TagName = "button";
function useCompositeItemOffscreen({ store, offscreenMode = "active", disabled, value, ...props }) {
	const context = useCompositeScopedContext();
	store = store || context;
	const id = useId(props.id);
	const { storeId, active, listElement, offscreenRoot } = useStoreStateObject(store, {
		storeId: "id",
		active(state) {
			if (!state) return;
			if (!("selectedValue" in state) && "value" in state) {
				if (state.value === value) return true;
			}
			return !!id && state.activeId === id;
		},
		listElement(state) {
			if (!state) return;
			if (!("listElement" in state)) return;
			return state.listElement;
		},
		offscreenRoot(state) {
			if (props.offscreenRoot) return props.offscreenRoot;
			if (!state) return;
			if (!("contentElement" in state)) return;
			return state.contentElement || null;
		}
	});
	const offscreenProps = useCollectionItemOffscreen({
		id,
		store,
		offscreenMode: active ? "active" : offscreenMode,
		...props,
		offscreenRoot
	});
	if (!offscreenProps.active) return {
		...offscreenProps,
		children: value,
		role: getPopupItemRole(listElement),
		"aria-disabled": disabled || void 0,
		"data-offscreen-id": storeId
	};
	return offscreenProps;
}
const CompositeItem = forwardRef(function CompositeItem({ offscreenMode, offscreenRoot, ...props }) {
	const { active, ref, ...rest } = useCompositeItemOffscreen({
		offscreenMode,
		offscreenRoot,
		...props
	});
	const allProps = {
		...rest,
		...props,
		ref: useMergeRefs(ref, props.ref)
	};
	if (active) return /* @__PURE__ */ jsx(CompositeItem$1, { ...allProps });
	const { store, rowId, preventScrollOnKeyDown, moveOnKeyPress, tabbable, getItem, ...htmlProps } = allProps;
	const Component = Role[TagName];
	return /* @__PURE__ */ jsx(Component, { ...htmlProps });
});
//#endregion
export { CompositeItem, useCompositeItemOffscreen };

//# sourceMappingURL=composite-item-offscreen.js.map