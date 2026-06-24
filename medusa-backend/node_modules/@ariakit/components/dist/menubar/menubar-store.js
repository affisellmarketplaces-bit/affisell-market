import { createCompositeStore } from "../composite/composite-store.js";
import { createStore } from "@ariakit/store";
import { defaultValue } from "@ariakit/utils";
//#region src/menubar/menubar-store.ts
/**
* Creates a menubar store.
*/
function createMenubarStore(props = {}) {
	const syncState = props.store?.getState();
	const composite = createCompositeStore({
		...props,
		orientation: defaultValue(props.orientation, syncState?.orientation, "horizontal"),
		focusLoop: defaultValue(props.focusLoop, syncState?.focusLoop, true)
	});
	const menubar = createStore({ ...composite.getState() }, composite, props.store);
	return {
		...composite,
		...menubar
	};
}
//#endregion
export { createMenubarStore };

//# sourceMappingURL=menubar-store.js.map