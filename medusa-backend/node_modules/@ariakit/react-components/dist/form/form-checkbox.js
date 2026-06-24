"use client";
import { useCheckboxStore } from "../checkbox/checkbox-store.js";
import { useCheckbox } from "../checkbox/checkbox.js";
import { useFormContext } from "./form-context.js";
import { useFormControl } from "./form-control.js";
import { createElement, createHook, forwardRef, memo } from "@ariakit/react-utils";
import { invariant } from "@ariakit/utils";
//#region src/form/form-checkbox.tsx
const TagName = "input";
/**
* Returns props to create a `FormCheckbox` component.
* @see https://ariakit.com/components/form
* @example
* ```jsx
* const store = useFormStore({ defaultValues: { acceptTerms: false } });
* const props = useFormCheckbox({ store, name: store.names.acceptTerms });
* <Form store={store}>
*   <label>
*     <Role {...props} />
*     Accept terms
*   </label>
* </Form>
* ```
*/
const useFormCheckbox = createHook(function useFormCheckbox({ store, name: nameProp, value, checked, defaultChecked, ...props }) {
	const context = useFormContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "FormCheckbox must be wrapped in a Form component.");
	const name = String(nameProp);
	props = useCheckbox({
		store: useCheckboxStore({
			value: store.useValue(name),
			setValue: (value) => store?.setValue(name, value)
		}),
		value,
		checked,
		...props
	});
	props = useFormControl({
		store,
		name,
		"aria-labelledby": void 0,
		...props
	});
	return props;
});
/**
* Renders a checkbox input as a form control, representing a boolean, string,
* number, or array value.
* @see https://ariakit.com/components/form
* @example
* ```jsx {9}
* const form = useFormStore({
*   defaultValues: {
*     acceptTerms: false,
*   },
* });
*
* <Form store={form}>
*   <label>
*     <FormCheckbox name={form.names.acceptTerms} />
*     Accept terms
*   </label>
* </Form>
* ```
*/
const FormCheckbox = memo(forwardRef(function FormCheckbox(props) {
	return createElement(TagName, useFormCheckbox(props));
}));
//#endregion
export { FormCheckbox, useFormCheckbox };

//# sourceMappingURL=form-checkbox.js.map