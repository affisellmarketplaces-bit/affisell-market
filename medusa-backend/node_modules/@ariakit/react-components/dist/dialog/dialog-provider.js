"use client";
import { DialogContextProvider } from "./dialog-context.js";
import { useDialogStore } from "./dialog-store.js";
import { jsx } from "react/jsx-runtime";
//#region src/dialog/dialog-provider.tsx
/**
* Provides a dialog store to [Dialog](https://ariakit.com/components/dialog)
* components.
* @see https://ariakit.com/components/dialog
* @example
* ```jsx
* <DialogProvider>
*   <Dialog />
* </DialogProvider>
* ```
*/
function DialogProvider(props = {}) {
	return /* @__PURE__ */ jsx(DialogContextProvider, {
		value: useDialogStore(props),
		children: props.children
	});
}
//#endregion
export { DialogProvider };

//# sourceMappingURL=dialog-provider.js.map