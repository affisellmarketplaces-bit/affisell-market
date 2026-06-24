import { a as ComboboxStoreProps, o as ComboboxStoreSelectedValue } from "../combobox-store-DEVQ45mZ.js";
import { ReactElement, ReactNode } from "react";
import { PickRequired } from "@ariakit/utils";

//#region src/combobox/combobox-provider.d.ts
type Value = ComboboxStoreSelectedValue;
/**
 * Provides a combobox store that controls the state of
 * [Combobox](https://ariakit.com/components/combobox) components.
 * @see https://ariakit.com/components/combobox
 * @example
 * ```jsx
 * <ComboboxProvider defaultValue="">
 *   <Combobox />
 *   <ComboboxPopover>
 *     <ComboboxItem value="Apple" />
 *     <ComboboxItem value="Banana" />
 *     <ComboboxItem value="Orange" />
 *   </ComboboxPopover>
 * </ComboboxProvider>
 * ```
 */
declare function ComboboxProvider<T extends Value = Value>(props: PickRequired<ComboboxProviderProps<T>, "selectedValue" | "defaultSelectedValue">): ReactElement;
declare function ComboboxProvider(props?: ComboboxProviderProps): ReactElement;
interface ComboboxProviderProps<T extends Value = Value> extends ComboboxStoreProps<T> {
  children?: ReactNode;
}
//#endregion
export { ComboboxProvider, ComboboxProviderProps };
//# sourceMappingURL=combobox-provider.d.ts.map