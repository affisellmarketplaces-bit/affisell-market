"use client";
import { FormContextProvider } from "./form-context.js";
import { useFormStore } from "./form-store.js";
import { jsx } from "react/jsx-runtime";
//#region src/form/form-provider.tsx
function FormProvider(props = {}) {
	return /* @__PURE__ */ jsx(FormContextProvider, {
		value: useFormStore(props),
		children: props.children
	});
}
//#endregion
export { FormProvider };

//# sourceMappingURL=form-provider.js.map