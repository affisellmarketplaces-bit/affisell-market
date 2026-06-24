import { createCompositeStore } from "../composite/composite-store.js";
import { createPopoverStore } from "../popover/popover-store.js";
import { batch, createStore, mergeStore, pick, setup, sync, throwOnConflictingProps } from "@ariakit/store";
import { chain, defaultValue, isSafari, isTouchDevice } from "@ariakit/utils";
//#region src/combobox/combobox-store.ts
const isTouchSafari = isSafari() && isTouchDevice();
function createComboboxStore({ tag, ...props } = {}) {
	const store = mergeStore(props.store, pick(tag, ["value", "rtl"]));
	throwOnConflictingProps(props, store);
	const tagState = tag?.getState();
	const syncState = store?.getState();
	const activeId = defaultValue(props.activeId, syncState?.activeId, props.defaultActiveId, null);
	const composite = createCompositeStore({
		...props,
		activeId,
		includesBaseElement: defaultValue(props.includesBaseElement, syncState?.includesBaseElement, true),
		orientation: defaultValue(props.orientation, syncState?.orientation, "vertical"),
		focusLoop: defaultValue(props.focusLoop, syncState?.focusLoop, true),
		focusWrap: defaultValue(props.focusWrap, syncState?.focusWrap, true),
		virtualFocus: defaultValue(props.virtualFocus, syncState?.virtualFocus, true)
	});
	const popover = createPopoverStore({
		...props,
		placement: defaultValue(props.placement, syncState?.placement, "bottom-start")
	});
	const value = defaultValue(props.value, syncState?.value, props.defaultValue, "");
	const selectedValue = defaultValue(props.selectedValue, syncState?.selectedValue, tagState?.values, props.defaultSelectedValue, "");
	const multiSelectable = Array.isArray(selectedValue);
	const initialState = {
		...composite.getState(),
		...popover.getState(),
		value,
		selectedValue,
		resetValueOnSelect: defaultValue(props.resetValueOnSelect, syncState?.resetValueOnSelect, multiSelectable),
		resetValueOnHide: defaultValue(props.resetValueOnHide, syncState?.resetValueOnHide, multiSelectable && !tag),
		activeValue: syncState?.activeValue
	};
	const combobox = createStore(initialState, composite, popover, store);
	if (isTouchSafari) setup(combobox, () => sync(combobox, ["virtualFocus"], () => {
		combobox.setState("virtualFocus", false);
	}));
	setup(combobox, () => {
		if (!tag) return;
		return chain(sync(combobox, ["selectedValue"], (state) => {
			if (!Array.isArray(state.selectedValue)) return;
			tag.setValues(state.selectedValue);
		}), sync(tag, ["values"], (state) => {
			combobox.setState("selectedValue", state.values);
		}));
	});
	setup(combobox, () => sync(combobox, ["resetValueOnHide", "mounted"], (state) => {
		if (!state.resetValueOnHide) return;
		if (state.mounted) return;
		combobox.setState("value", value);
	}));
	setup(combobox, () => sync(combobox, ["open"], (state) => {
		if (state.open) return;
		combobox.setState("activeId", activeId);
		combobox.setState("moves", 0);
	}));
	setup(combobox, () => sync(combobox, ["moves", "activeId"], (state, prevState) => {
		if (state.moves === prevState.moves) combobox.setState("activeValue", void 0);
	}));
	setup(combobox, () => batch(combobox, ["moves", "renderedItems"], (state, prev) => {
		if (state.moves === prev.moves) return;
		const { activeId } = combobox.getState();
		const activeItem = composite.item(activeId);
		combobox.setState("activeValue", activeItem?.value);
	}));
	return {
		...popover,
		...composite,
		...combobox,
		tag,
		setValue: (value) => combobox.setState("value", value),
		resetValue: () => combobox.setState("value", initialState.value),
		setSelectedValue: (selectedValue) => combobox.setState("selectedValue", selectedValue)
	};
}
//#endregion
export { createComboboxStore };

//# sourceMappingURL=combobox-store.js.map