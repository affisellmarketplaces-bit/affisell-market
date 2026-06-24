import { n as CollectionItemOptions } from "../collection-item-pvEWNoNs.js";
import { t as FormStore } from "../form-store-C4Kf5QHm.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";
import { StringLike } from "@ariakit/components/form/types";

//#region src/form/form-error.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `FormDescription` component.
 * @see https://ariakit.com/components/form
 * @example
 * ```jsx
 * const store = useFormStore({ defaultValues: { email: "" } });
 * const props = useFormError({ store, name: store.names.email });
 *
 * store.useValidate(() => {
 *   if (!store.getValue(store.names.email)) {
 *     store.setError(store.names.email, "Email is required!");
 *   }
 * });
 *
 * <Form store={store}>
 *   <FormLabel name={store.names.email}>Email</FormLabel>
 *   <FormInput name={store.names.email} />
 *   <Role {...props} />
 * </Form>
 * ```
 */
declare const useFormError: import("@ariakit/react-utils").Hook<"div", FormErrorOptions<"div">>;
/**
 * Renders an element that shows an error message. The `children` will
 * automatically display the error message defined in the store.
 * @see https://ariakit.com/components/form
 * @example
 * ```jsx {16}
 * const form = useFormStore({
 *   defaultValues: {
 *     email: "",
 *   },
 * });
 *
 * form.useValidate(() => {
 *   if (!form.values.email) {
 *     form.setError(form.names.email, "Email is required!");
 *   }
 * });
 *
 * <Form store={form}>
 *   <FormLabel name={form.names.email}>Email</FormLabel>
 *   <FormInput name={form.names.email} />
 *   <FormError name={form.names.email} />
 * </Form>
 * ```
 */
declare const FormError: (props: FormErrorProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface FormErrorOptions<T extends ElementType = TagName> extends CollectionItemOptions<T> {
  /**
   * Object returned by the
   * [`useFormStore`](https://ariakit.com/reference/use-form-store) hook. If not
   * provided, the closest [`Form`](https://ariakit.com/reference/form) or
   * [`FormProvider`](https://ariakit.com/reference/form-provider) components'
   * context will be used.
   */
  store?: FormStore;
  /**
   * Name of the field associated with this error. This can either be a string
   * or a reference to a field name from the
   * [`names`](https://ariakit.com/reference/use-form-store#names) object in the
   * store, for type safety.
   * @example
   * ```jsx
   * <FormError name="password" />
   * ```
   */
  name: StringLike;
}
type FormErrorProps<T extends ElementType = TagName> = Props<T, FormErrorOptions<T>>;
//#endregion
export { FormError, FormErrorOptions, FormErrorProps, useFormError };
//# sourceMappingURL=form-error.d.ts.map