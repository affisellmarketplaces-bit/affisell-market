"use client";
import { RadioContextProvider } from "./radio-context.js";
import { useRadioStore } from "./radio-store.js";
import { jsx } from "react/jsx-runtime";
//#region src/radio/radio-provider.tsx
/**
* Provides a radio store to [Radio](https://ariakit.com/components/radio)
* components.
* @see https://ariakit.com/components/radio
* @example
* ```jsx
* <RadioProvider defaultValue="Apple">
*   <RadioGroup>
*     <Radio value="Apple" />
*     <Radio value="Orange" />
*   </RadioGroup>
* </RadioProvider>
* ```
*/
function RadioProvider(props = {}) {
	return /* @__PURE__ */ jsx(RadioContextProvider, {
		value: useRadioStore(props),
		children: props.children
	});
}
//#endregion
export { RadioProvider };

//# sourceMappingURL=radio-provider.js.map