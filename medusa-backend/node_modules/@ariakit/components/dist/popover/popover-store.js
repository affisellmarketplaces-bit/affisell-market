import { createDialogStore } from "../dialog/dialog-store.js";
import { createStore, mergeStore, omit, throwOnConflictingProps } from "@ariakit/store";
import { defaultValue } from "@ariakit/utils";
//#region src/popover/popover-store.ts
/**
* Creates a popover store.
*/
function createPopoverStore({ popover: otherPopover, ...props } = {}) {
	const store = mergeStore(props.store, omit(otherPopover, [
		"arrowElement",
		"anchorElement",
		"contentElement",
		"popoverElement",
		"disclosureElement"
	]));
	throwOnConflictingProps(props, store);
	const syncState = store?.getState();
	const dialog = createDialogStore({
		...props,
		store
	});
	const placement = defaultValue(props.placement, syncState?.placement, "bottom");
	const popover = createStore({
		...dialog.getState(),
		placement,
		currentPlacement: placement,
		anchorElement: defaultValue(syncState?.anchorElement, null),
		popoverElement: defaultValue(syncState?.popoverElement, null),
		arrowElement: defaultValue(syncState?.arrowElement, null),
		rendered: Symbol("rendered")
	}, dialog, store);
	return {
		...dialog,
		...popover,
		setAnchorElement: (element) => popover.setState("anchorElement", element),
		setPopoverElement: (element) => popover.setState("popoverElement", element),
		setArrowElement: (element) => popover.setState("arrowElement", element),
		render: () => popover.setState("rendered", Symbol("rendered"))
	};
}
//#endregion
export { createPopoverStore };

//# sourceMappingURL=popover-store.js.map