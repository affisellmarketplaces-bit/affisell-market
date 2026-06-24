import { i as CheckboxStoreProps, o as CheckboxStoreValue } from "../checkbox-store-CYZPR4N4.js";
import { ReactElement, ReactNode } from "react";
import { PickRequired } from "@ariakit/utils";

//#region src/checkbox/checkbox-provider.d.ts
type Value = CheckboxStoreValue;
/**
 * Provides a checkbox store for its descendants. This comes in handy when
 * creating a group of checkboxes that share the same state. `CheckboxProvider`
 * can efficiently manage the value of a checkbox, whether it's a single string,
 * number, or boolean value, or an array of such values.
 * @see https://ariakit.com/components/checkbox
 * @example
 * ```jsx
 * <CheckboxProvider defaultValue={["orange"]}>
 *   <label>
 *     <Checkbox value="apple" /> Apple
 *   </label>
 *   <label>
 *     <Checkbox value="orange" /> Orange
 *   </label>
 *   <label>
 *     <Checkbox value="mango" /> Mango
 *   </label>
 * </CheckboxProvider>
 * ```
 */
declare function CheckboxProvider<T extends Value = Value>(props: PickRequired<CheckboxProviderProps<T>, "value" | "defaultValue">): ReactElement;
declare function CheckboxProvider(props?: CheckboxProviderProps): ReactElement;
interface CheckboxProviderProps<T extends Value = Value> extends CheckboxStoreProps<T> {
  children?: ReactNode;
}
//#endregion
export { CheckboxProvider, CheckboxProviderProps };
//# sourceMappingURL=checkbox-provider.d.ts.map