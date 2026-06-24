import { a as SelectStoreProps, s as SelectStoreValue } from "../select-store-BsLTAyKh.js";
import { ReactElement, ReactNode } from "react";
import { PickRequired } from "@ariakit/utils";

//#region src/select/select-provider.d.ts
type Value = SelectStoreValue;
/**
 * Provides a select store to [Select](https://ariakit.com/components/select)
 * components.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * <SelectProvider defaultValue="Apple">
 *   <Select />
 *   <SelectPopover>
 *     <SelectItem value="Apple" />
 *     <SelectItem value="Banana" />
 *     <SelectItem value="Orange" />
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare function SelectProvider<T extends Value = Value>(props: PickRequired<SelectProviderProps<T>, "value" | "defaultValue">): ReactElement;
declare function SelectProvider(props?: SelectProviderProps): ReactElement;
interface SelectProviderProps<T extends Value = Value> extends SelectStoreProps<T> {
  children?: ReactNode;
}
//#endregion
export { SelectProvider, SelectProviderProps };
//# sourceMappingURL=select-provider.d.ts.map