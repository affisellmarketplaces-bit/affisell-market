import { a as FormStoreProps } from "../form-store-C4Kf5QHm.js";
import { ReactElement, ReactNode } from "react";
import { PickRequired } from "@ariakit/utils";
import { FormStoreValues } from "@ariakit/components/form/form-store";

//#region src/form/form-provider.d.ts
type Values = FormStoreValues;
/**
 * Provides a form store to [Form](https://ariakit.com/components/form)
 * components.
 * @see https://ariakit.com/components/form
 * @example
 * ```jsx
 * <FormProvider defaultValues={{ email: "" }}>
 *   <Form>
 *     <FormInput />
 *   </Form>
 * </FormProvider>
 * ```
 */
declare function FormProvider<T extends Values = Values>(props: PickRequired<FormProviderProps<T>, "values" | "defaultValues" | "errors" | "defaultErrors" | "touched" | "defaultTouched">): ReactElement;
declare function FormProvider(props: FormProviderProps): ReactElement;
interface FormProviderProps<T extends Values = Values> extends FormStoreProps<T> {
  children?: ReactNode;
}
//#endregion
export { FormProvider, FormProviderProps };
//# sourceMappingURL=form-provider.d.ts.map