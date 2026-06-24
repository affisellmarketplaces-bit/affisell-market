import { i as CollectionStoreOptions, n as CollectionStoreFunctions, o as CollectionStoreState } from "./collection-store-CbwzYsWf.js";
import { PickRequired } from "@ariakit/utils";
import { Store } from "@ariakit/react-store";
import { StringLike } from "@ariakit/components/form/types";
import * as Core from "@ariakit/components/form/form-store";

//#region src/form/form-store.d.ts
declare function useFormStoreProps<T extends Omit<FormStore, "useValue" | "useValidate" | "useSubmit">>(store: T, update: () => void, props: FormStoreProps): T & {
  useValue: <T_1 = any>(name: StringLike) => T_1;
  useValidate: (callback: Core.FormStoreCallback<FormStoreState<FormStoreValues$1>>) => void;
  useSubmit: (callback: Core.FormStoreCallback<FormStoreState<FormStoreValues$1>>) => void;
};
/**
 * Creates a form store to control the state of
 * [Form](https://ariakit.com/components/form) components.
 * @example
 * ```jsx
 * const form = useFormStore({
 *   defaultValues: {
 *     email: "",
 *   },
 * });
 *
 * <Form store={form}>
 *   <FormLabel name={form.names.email}>Email</FormLabel>
 *   <FormInput name={form.names.email} />
 *   <FormError name={form.names.email} />
 *   <FormSubmit>Submit</FormSubmit>
 * </Form>
 * ```
 */
declare function useFormStore<T extends FormStoreValues$1 = FormStoreValues$1>(props: PickRequired<FormStoreProps<T>, "values" | "defaultValues" | "errors" | "defaultErrors" | "touched" | "defaultTouched">): FormStore<T>;
declare function useFormStore(props: FormStoreProps): FormStore;
interface FormStoreValues$1 extends Core.FormStoreValues {}
interface FormStoreItem extends Core.FormStoreItem {}
interface FormStoreState<T extends FormStoreValues$1 = FormStoreValues$1> extends Core.FormStoreState<T>, CollectionStoreState<FormStoreItem> {}
interface FormStoreFunctions<T extends FormStoreValues$1 = FormStoreValues$1> extends Core.FormStoreFunctions<T>, CollectionStoreFunctions<FormStoreItem> {
  /**
   * A custom hook that rerenders the component when the value of the given
   * field changes. It accepts a string or a reference to a field name from the
   * [`names`](https://ariakit.com/reference/use-form-store#names) object in the
   * store, for type safety. It returns the value of the field.
   *
   * Live examples:
   * - [Form with Select](https://ariakit.com/examples/form-select)
   * @example
   * const nameValue = store.useValue("name");
   * // Can also use store.names for type safety.
   * const emailValue = store.useValue(store.names.email);
   */
  useValue: <T = any>(name: StringLike) => T;
  /**
   * Custom hook that accepts a callback that will be used to validate the form
   * when [`validate`](https://ariakit.com/reference/use-form-store#validate) is
   * called, typically when a form field is touched or when the form is
   * submitted.
   *
   * Live examples:
   * - [FormRadio](https://ariakit.com/examples/form-radio)
   * @example
   * store.useValidate(async (state) => {
   *   const errors = await api.validate(state.values);
   *   if (errors) {
   *     store.setErrors(errors);
   *   }
   * });
   */
  useValidate: (callback: Core.FormStoreCallback<FormStoreState<T>>) => void;
  /**
   * Custom hook that accepts a callback that will be used to submit the form
   * when [`submit`](https://ariakit.com/reference/use-form-store#submit) is
   * called.
   *
   * Live examples:
   * - [FormRadio](https://ariakit.com/examples/form-radio)
   * - [Form with Select](https://ariakit.com/examples/form-select)
   * @example
   * store.useSubmit(async (state) => {
   *   try {
   *     await api.submit(state.values);
   *   } catch (errors) {
   *     store.setErrors(errors);
   *   }
   * });
   */
  useSubmit: (callback: Core.FormStoreCallback<FormStoreState<T>>) => void;
}
interface FormStoreOptions<T extends FormStoreValues$1 = FormStoreValues$1> extends Core.FormStoreOptions<T>, CollectionStoreOptions<FormStoreItem> {
  /**
   * Function that will be called when
   * [`values`](https://ariakit.com/reference/use-form-store#values) state
   * changes.
   * @example
   * function MyForm({ values, onChange }) {
   *   const form = useFormStore({ values, setValues: onChange });
   * }
   */
  setValues?: (values: FormStoreState<T>["values"]) => void;
  /**
   * Function that will be called when the
   * [`errors`](https://ariakit.com/reference/use-form-store#errors) state
   * changes.
   * @example
   * useFormStore({ setErrors: (errors) => console.log(errors) });
   */
  setErrors?: (errors: FormStoreState<T>["errors"]) => void;
  /**
   * Function that will be called when the
   * [`touched`](https://ariakit.com/reference/use-form-store#touched) state
   * changes.
   * @example
   * useFormStore({ setTouched: (touched) => console.log(touched) });
   */
  setTouched?: (touched: FormStoreState<T>["touched"]) => void;
}
interface FormStoreProps<T extends FormStoreValues$1 = FormStoreValues$1> extends FormStoreOptions<T>, Core.FormStoreProps<T> {}
interface FormStore<T extends FormStoreValues$1 = FormStoreValues$1> extends FormStoreFunctions<T>, Store<Core.FormStore<T>> {}
//#endregion
export { FormStoreProps as a, useFormStore as c, FormStoreOptions as i, useFormStoreProps as l, FormStoreFunctions as n, FormStoreState as o, FormStoreItem as r, FormStoreValues$1 as s, FormStore as t };
//# sourceMappingURL=form-store-C4Kf5QHm.d.ts.map