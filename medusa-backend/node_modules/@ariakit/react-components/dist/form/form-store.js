"use client";
import { useCollectionStoreProps } from "../collection/collection-store.js";
import { useEvent } from "@ariakit/react-utils";
import { useCallback, useEffect, useMemo } from "react";
import { useStore, useStoreProps, useStoreState } from "@ariakit/react-store";
import * as Core from "@ariakit/components/form/form-store";
//#region src/form/form-store.ts
function useFormStoreProps(store, update, props) {
	store = useCollectionStoreProps(store, update, props);
	useStoreProps(store, props, "values", "setValues");
	useStoreProps(store, props, "errors", "setErrors");
	useStoreProps(store, props, "touched", "setTouched");
	const useValue = useCallback((name) => useStoreState(store, () => store.getValue(name)), [store]);
	const useValidate = useCallback((callback) => {
		callback = useEvent(callback);
		useEffect(() => store.onValidate(callback), [useStoreState(store, "items"), callback]);
	}, [store]);
	const useSubmit = useCallback((callback) => {
		callback = useEvent(callback);
		useEffect(() => store.onSubmit(callback), [useStoreState(store, "items"), callback]);
	}, [store]);
	return useMemo(() => ({
		...store,
		useValue,
		useValidate,
		useSubmit
	}), [
		store,
		useValue,
		useValidate,
		useSubmit
	]);
}
function useFormStore(props = {}) {
	const [store, update] = useStore(Core.createFormStore, props);
	return useFormStoreProps(store, update, props);
}
//#endregion
export { useFormStore, useFormStoreProps };

//# sourceMappingURL=form-store.js.map