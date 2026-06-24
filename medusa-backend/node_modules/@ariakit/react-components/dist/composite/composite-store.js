"use client";
import { useCollectionStoreProps } from "../collection/collection-store.js";
import { useId } from "@ariakit/react-utils";
import { useStore, useStoreProps } from "@ariakit/react-store";
import * as Core from "@ariakit/components/composite/composite-store";
//#region src/composite/composite-store.ts
function useCompositeStoreOptions(props) {
	return {
		id: useId(props.id),
		...props
	};
}
function useCompositeStoreProps(store, update, props) {
	store = useCollectionStoreProps(store, update, props);
	useStoreProps(store, props, "activeId", "setActiveId");
	useStoreProps(store, props, "includesBaseElement");
	useStoreProps(store, props, "virtualFocus");
	useStoreProps(store, props, "orientation");
	useStoreProps(store, props, "rtl");
	useStoreProps(store, props, "focusLoop");
	useStoreProps(store, props, "focusWrap");
	useStoreProps(store, props, "focusShift");
	return store;
}
function useCompositeStore(props = {}) {
	props = useCompositeStoreOptions(props);
	const [store, update] = useStore(Core.createCompositeStore, props);
	return useCompositeStoreProps(store, update, props);
}
//#endregion
export { useCompositeStore, useCompositeStoreOptions, useCompositeStoreProps };

//# sourceMappingURL=composite-store.js.map