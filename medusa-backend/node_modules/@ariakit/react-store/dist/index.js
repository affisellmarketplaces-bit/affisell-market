"use client";
import { useEvent, useLiveRef, useSafeLayoutEffect } from "@ariakit/react-utils";
import { batch, init, subscribe, sync } from "@ariakit/store";
import { hasOwnProperty, identity } from "@ariakit/utils";
import * as React from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
//#region src/index.tsx
const noopSubscribe = () => () => {};
function useStoreState(store, keyOrSelector = identity) {
	const storeSubscribe = React.useCallback((callback) => {
		if (!store) return noopSubscribe();
		return subscribe(store, null, callback);
	}, [store]);
	const getSnapshot = () => {
		const key = typeof keyOrSelector === "string" ? keyOrSelector : null;
		const selector = typeof keyOrSelector === "function" ? keyOrSelector : null;
		const state = store?.getState();
		if (selector) return selector(state);
		if (!state) return;
		if (!key) return;
		if (!hasOwnProperty(state, key)) return;
		return state[key];
	};
	return useSyncExternalStore(storeSubscribe, getSnapshot, getSnapshot);
}
function useStoreStateObject(store, object) {
	const objRef = React.useRef({});
	const storeSubscribe = React.useCallback((callback) => {
		if (!store) return noopSubscribe();
		return subscribe(store, null, callback);
	}, [store]);
	const getSnapshot = () => {
		const state = store?.getState();
		let updated = false;
		const obj = objRef.current;
		for (const prop in object) {
			const keyOrSelector = object[prop];
			if (typeof keyOrSelector === "function") {
				const value = keyOrSelector(state);
				if (value !== obj[prop]) {
					obj[prop] = value;
					updated = true;
				}
			}
			if (typeof keyOrSelector === "string") {
				if (!state) continue;
				if (!hasOwnProperty(state, keyOrSelector)) continue;
				const value = state[keyOrSelector];
				if (value !== obj[prop]) {
					obj[prop] = value;
					updated = true;
				}
			}
		}
		if (updated) objRef.current = { ...obj };
		return objRef.current;
	};
	return useSyncExternalStore(storeSubscribe, getSnapshot, getSnapshot);
}
/**
* Synchronizes the store with the props, including parent store props.
* @param store The store to synchronize.
* @param props The props to synchronize with.
* @param key The key of the value prop.
* @param setKey The key of the setValue prop.
*/
function useStoreProps(store, props, key, setKey) {
	const value = hasOwnProperty(props, key) ? props[key] : void 0;
	const propsRef = useLiveRef({
		value,
		setValue: setKey ? props[setKey] : void 0
	});
	useSafeLayoutEffect(() => {
		return sync(store, [key], (state, prev) => {
			const { value, setValue } = propsRef.current;
			if (!setValue) return;
			if (state[key] === prev[key]) return;
			if (state[key] === value) return;
			setValue(state[key]);
		});
	}, [store, key]);
	useSafeLayoutEffect(() => {
		if (value === void 0) return;
		store.setState(key, value);
		return batch(store, [key], () => {
			if (value === void 0) return;
			store.setState(key, value);
		});
	});
}
/**
* Creates a React store from a core store object and returns a tuple with the
* store and a function to update the store.
* @param createStore A function that receives the props and returns a core
* store object.
* @param props The props to pass to the createStore function.
*/
function useStore(createStore, props) {
	const [store, setStore] = React.useState(() => createStore(props));
	useSafeLayoutEffect(() => init(store), [store]);
	const useState = React.useCallback((keyOrSelector) => useStoreState(store, keyOrSelector), [store]);
	return [React.useMemo(() => ({
		...store,
		useState
	}), [store, useState]), useEvent(() => {
		setStore((store) => createStore({
			...props,
			...store.getState()
		}));
	})];
}
//#endregion
export { useStore, useStoreProps, useStoreState, useStoreStateObject };

//# sourceMappingURL=index.js.map