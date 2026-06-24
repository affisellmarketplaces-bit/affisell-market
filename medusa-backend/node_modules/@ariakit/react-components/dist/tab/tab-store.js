"use client";
import { useComboboxContext } from "../combobox/combobox-context.js";
import { useCompositeStoreProps } from "../composite/composite-store.js";
import { useSelectContext } from "../select/select-context.js";
import { useUpdateEffect } from "@ariakit/react-utils";
import { useMemo } from "react";
import { useStore, useStoreProps } from "@ariakit/react-store";
import * as Core from "@ariakit/components/tab/tab-store";
//#region src/tab/tab-store.ts
function useTabStoreProps(store, update, props) {
	useUpdateEffect(update, [props.composite, props.combobox]);
	store = useCompositeStoreProps(store, update, props);
	useStoreProps(store, props, "selectedId", "setSelectedId");
	useStoreProps(store, props, "selectOnMove");
	const [panels, updatePanels] = useStore(() => store.panels, {});
	useUpdateEffect(updatePanels, [store, updatePanels]);
	return Object.assign(useMemo(() => ({
		...store,
		panels
	}), [store, panels]), {
		composite: props.composite,
		combobox: props.combobox
	});
}
/**
* Creates a tab store to control the state of
* [Tab](https://ariakit.com/components/tab) components.
* @see https://ariakit.com/components/tab
* @example
* ```jsx
* const tab = useTabStore();
*
* <TabList store={tab}>
*   <Tab>Tab 1</Tab>
*   <Tab>Tab 2</Tab>
* </TabList>
* <TabPanel store={tab}>Panel 1</TabPanel>
* <TabPanel store={tab}>Panel 2</TabPanel>
* ```
*/
function useTabStore(props = {}) {
	const combobox = useComboboxContext();
	const composite = useSelectContext() || combobox;
	props = {
		...props,
		composite: props.composite !== void 0 ? props.composite : composite,
		combobox: props.combobox !== void 0 ? props.combobox : combobox
	};
	const [store, update] = useStore(Core.createTabStore, props);
	return useTabStoreProps(store, update, props);
}
//#endregion
export { useTabStore, useTabStoreProps };

//# sourceMappingURL=tab-store.js.map