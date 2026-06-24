import { createStore, throwOnConflictingProps } from "@ariakit/store";
import { defaultValue } from "@ariakit/utils";
//#region src/checkbox/checkbox-store.ts
function createCheckboxStore(props = {}) {
	throwOnConflictingProps(props, props.store);
	const syncState = props.store?.getState();
	const checkbox = createStore({ value: defaultValue(props.value, syncState?.value, props.defaultValue, false) }, props.store);
	return {
		...checkbox,
		setValue: (value) => checkbox.setState("value", value)
	};
}
//#endregion
export { createCheckboxStore };

//# sourceMappingURL=checkbox-store.js.map