"use client";
import { ComboboxContextProvider } from "./combobox-context.js";
import { useComboboxStore } from "./combobox-store.js";
import { jsx } from "react/jsx-runtime";
//#region src/combobox/combobox-provider.tsx
function ComboboxProvider(props = {}) {
	return /* @__PURE__ */ jsx(ComboboxContextProvider, {
		value: useComboboxStore(props),
		children: props.children
	});
}
//#endregion
export { ComboboxProvider };

//# sourceMappingURL=combobox-provider.js.map