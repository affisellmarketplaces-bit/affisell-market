import { createPopoverStore } from "../popover/popover-store.js";
import { createStore } from "@ariakit/store";
import { defaultValue } from "@ariakit/utils";
//#region src/hovercard/hovercard-store.ts
/**
* Creates a hovercard store.
*/
function createHovercardStore(props = {}) {
	const syncState = props.store?.getState();
	const popover = createPopoverStore({
		...props,
		placement: defaultValue(props.placement, syncState?.placement, "bottom")
	});
	const timeout = defaultValue(props.timeout, syncState?.timeout, 500);
	const hovercard = createStore({
		...popover.getState(),
		timeout,
		showTimeout: defaultValue(props.showTimeout, syncState?.showTimeout),
		hideTimeout: defaultValue(props.hideTimeout, syncState?.hideTimeout),
		autoFocusOnShow: defaultValue(syncState?.autoFocusOnShow, false)
	}, popover, props.store);
	return {
		...popover,
		...hovercard,
		setAutoFocusOnShow: (value) => hovercard.setState("autoFocusOnShow", value)
	};
}
//#endregion
export { createHovercardStore };

//# sourceMappingURL=hovercard-store.js.map