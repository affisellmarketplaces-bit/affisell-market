import { Store, StoreOptions, StoreProps } from "@ariakit/store";
import { PickRequired, SetState, ToPrimitive } from "@ariakit/utils";

//#region src/checkbox/checkbox-store.d.ts
/**
 * Creates a checkbox store.
 */
declare function createCheckboxStore<T extends CheckboxStoreValue = CheckboxStoreValue>(props: PickRequired<CheckboxStoreProps<T>, "value" | "defaultValue">): CheckboxStore<T>;
declare function createCheckboxStore(props?: CheckboxStoreProps): CheckboxStore;
type CheckboxStoreValue = boolean | string | number | ReadonlyArray<string | number>;
interface CheckboxStoreState<T extends CheckboxStoreValue = CheckboxStoreValue> {
  /**
   * The checked state of the checkbox.
   *
   * Live examples:
   * - [Custom Checkbox](https://ariakit.com/examples/checkbox-custom)
   */
  value: ToPrimitive<T>;
}
interface CheckboxStoreFunctions<T extends CheckboxStoreValue = CheckboxStoreValue> {
  /**
   * Sets the [`value`](https://ariakit.com/reference/checkbox-provider#value)
   * state.
   * @example
   * store.setValue(true);
   * store.setValue((value) => !value);
   */
  setValue: SetState<CheckboxStoreState<T>["value"]>;
}
interface CheckboxStoreOptions<T extends CheckboxStoreValue = CheckboxStoreValue> extends StoreOptions<CheckboxStoreState<T>, "value"> {
  /**
   * The default
   * [`value`](https://ariakit.com/reference/checkbox-provider#value) state of
   * the checkbox.
   *
   * Live examples:
   * - [Custom Checkbox](https://ariakit.com/examples/checkbox-custom)
   * - [Checkbox group](https://ariakit.com/examples/checkbox-group)
   * @default false
   */
  defaultValue?: CheckboxStoreState<T>["value"];
}
interface CheckboxStoreProps<T extends CheckboxStoreValue = CheckboxStoreValue> extends CheckboxStoreOptions<T>, StoreProps<CheckboxStoreState<T>> {}
interface CheckboxStore<T extends CheckboxStoreValue = CheckboxStoreValue> extends CheckboxStoreFunctions<T>, Store<CheckboxStoreState<T>> {}
//#endregion
export { CheckboxStore, CheckboxStoreFunctions, CheckboxStoreOptions, CheckboxStoreProps, CheckboxStoreState, CheckboxStoreValue, createCheckboxStore };
//# sourceMappingURL=checkbox-store.d.ts.map