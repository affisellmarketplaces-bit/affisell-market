"use client";
import { CheckboxContextProvider } from "./checkbox-context.js";
import { useCheckboxStore } from "./checkbox-store.js";
import { jsx } from "react/jsx-runtime";
//#region src/checkbox/checkbox-provider.tsx
function CheckboxProvider(props = {}) {
	return /* @__PURE__ */ jsx(CheckboxContextProvider, {
		value: useCheckboxStore(props),
		children: props.children
	});
}
//#endregion
export { CheckboxProvider };

//# sourceMappingURL=checkbox-provider.js.map