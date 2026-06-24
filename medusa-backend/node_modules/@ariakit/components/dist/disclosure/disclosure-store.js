import { createStore, mergeStore, omit, setup, subscribe, sync, throwOnConflictingProps } from "@ariakit/store";
import { defaultValue } from "@ariakit/utils";
//#region src/disclosure/disclosure-store.ts
/**
* Creates a disclosure store.
*/
function createDisclosureStore(props = {}) {
	const store = mergeStore(props.store, omit(props.disclosure, ["contentElement", "disclosureElement"]));
	throwOnConflictingProps(props, store);
	const syncState = store?.getState();
	const open = defaultValue(props.open, syncState?.open, props.defaultOpen, false);
	const animated = defaultValue(props.animated, syncState?.animated, false);
	const disclosure = createStore({
		open,
		animated,
		animating: !!animated && open,
		mounted: open,
		contentElement: defaultValue(syncState?.contentElement, null),
		disclosureElement: defaultValue(syncState?.disclosureElement, null)
	}, store);
	setup(disclosure, () => sync(disclosure, ["animated", "animating"], (state) => {
		if (state.animated) return;
		disclosure.setState("animating", false);
	}));
	setup(disclosure, () => subscribe(disclosure, ["open"], () => {
		if (!disclosure.getState().animated) return;
		disclosure.setState("animating", true);
	}));
	setup(disclosure, () => sync(disclosure, ["open", "animating"], (state) => {
		disclosure.setState("mounted", state.open || state.animating);
	}));
	return {
		...disclosure,
		disclosure: props.disclosure,
		setOpen: (value) => disclosure.setState("open", value),
		show: () => disclosure.setState("open", true),
		hide: () => disclosure.setState("open", false),
		toggle: () => disclosure.setState("open", (open) => !open),
		stopAnimation: () => disclosure.setState("animating", false),
		setContentElement: (value) => disclosure.setState("contentElement", value),
		setDisclosureElement: (value) => disclosure.setState("disclosureElement", value)
	};
}
//#endregion
export { createDisclosureStore };

//# sourceMappingURL=disclosure-store.js.map