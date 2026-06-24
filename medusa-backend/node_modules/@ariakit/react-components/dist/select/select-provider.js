"use client";
import { SelectContextProvider } from "./select-context.js";
import { useSelectStore } from "./select-store.js";
import { jsx } from "react/jsx-runtime";
//#region src/select/select-provider.tsx
function SelectProvider(props = {}) {
	return /* @__PURE__ */ jsx(SelectContextProvider, {
		value: useSelectStore(props),
		children: props.children
	});
}
//#endregion
export { SelectProvider };

//# sourceMappingURL=select-provider.js.map