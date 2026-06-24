import { t as DisclosureStore } from "./disclosure-store-BsaBaRKv.js";
import { i as CompositeStoreOptions, n as CompositeStoreFunctions, o as CompositeStoreState } from "./composite-store-DyJc-XRA.js";
import { a as PopoverStoreState, n as PopoverStoreFunctions, r as PopoverStoreOptions } from "./popover-store-Bc-l5VVO.js";
import { t as ComboboxStore } from "./combobox-store-DEVQ45mZ.js";
import { BivariantCallback, PickRequired } from "@ariakit/utils";
import { Store } from "@ariakit/react-store";
import * as Core from "@ariakit/components/select/select-store";

//#region src/select/select-store.d.ts
declare function useSelectStoreOptions<T extends Core.SelectStoreOptions>(props: T): {
  id: string | undefined;
} & T;
declare function useSelectStoreProps<T extends Core.SelectStore>(store: T, update: () => void, props: SelectStoreProps): T & {
  disclosure: DisclosureStore | null | undefined;
} & {
  combobox: ComboboxStore<import("@ariakit/components/combobox/combobox-store").ComboboxStoreSelectedValue> | null | undefined;
};
/**
 * Creates a select store to control the state of
 * [Select](https://ariakit.com/components/select) components.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const select = useSelectStore({ defaultValue: "Apple" });
 *
 * <Select store={select} />
 * <SelectPopover store={select}>
 *   <SelectItem value="Apple" />
 *   <SelectItem value="Orange" />
 * </SelectPopover>
 * ```
 */
declare function useSelectStore<T extends SelectStoreValue = SelectStoreValue>(props: PickRequired<SelectStoreProps<T>, "value" | "defaultValue">): SelectStore<T>;
declare function useSelectStore(props?: SelectStoreProps): SelectStore;
type SelectStoreValue = Core.SelectStoreValue;
interface SelectStoreItem extends Core.SelectStoreItem {}
interface SelectStoreState<T extends SelectStoreValue = SelectStoreValue> extends Core.SelectStoreState<T>, CompositeStoreState<SelectStoreItem>, PopoverStoreState {}
interface SelectStoreFunctions<T extends SelectStoreValue = SelectStoreValue> extends Pick<SelectStoreOptions<T>, "combobox" | "disclosure">, Omit<Core.SelectStoreFunctions<T>, "combobox" | "disclosure">, CompositeStoreFunctions<SelectStoreItem>, PopoverStoreFunctions {}
interface SelectStoreOptions<T extends SelectStoreValue = SelectStoreValue> extends Omit<Core.SelectStoreOptions<T>, "combobox" | "disclosure">, CompositeStoreOptions<SelectStoreItem>, PopoverStoreOptions {
  /**
   * Function that will be called when the
   * [`value`](https://ariakit.com/reference/select-provider#value) state
   * changes.
   *
   * Live examples:
   * - [Form with Select](https://ariakit.com/examples/form-select)
   * - [Select Grid](https://ariakit.com/examples/select-grid)
   * - [Select with custom
   *   items](https://ariakit.com/examples/select-item-custom)
   * - [Multi-Select](https://ariakit.com/examples/select-multiple)
   * - [Toolbar with Select](https://ariakit.com/examples/toolbar-select)
   * - [Select with Next.js App
   *   Router](https://ariakit.com/examples/select-next-router)
   */
  setValue?: BivariantCallback<(value: SelectStoreState<T>["value"]) => void>;
  /**
   * A reference to a [combobox
   * store](https://ariakit.com/reference/use-combobox-store). It's
   * automatically set when composing [Select with
   * Combobox](https://ariakit.com/examples/select-combobox).
   */
  combobox?: ComboboxStore | null;
}
interface SelectStoreProps<T extends SelectStoreValue = SelectStoreValue> extends SelectStoreOptions<T>, Omit<Core.SelectStoreProps<T>, "combobox" | "disclosure"> {}
interface SelectStore<T extends SelectStoreValue = SelectStoreValue> extends SelectStoreFunctions<T>, Omit<Store<Core.SelectStore<T>>, "combobox" | "disclosure"> {}
//#endregion
export { SelectStoreProps as a, useSelectStore as c, SelectStoreOptions as i, useSelectStoreOptions as l, SelectStoreFunctions as n, SelectStoreState as o, SelectStoreItem as r, SelectStoreValue as s, SelectStore as t, useSelectStoreProps as u };
//# sourceMappingURL=select-store-BsLTAyKh.d.ts.map