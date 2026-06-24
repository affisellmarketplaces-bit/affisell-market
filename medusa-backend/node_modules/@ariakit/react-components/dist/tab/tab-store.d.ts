import { i as CompositeStoreOptions, n as CompositeStoreFunctions, o as CompositeStoreState, r as CompositeStoreItem, t as CompositeStore } from "../composite-store-DyJc-XRA.js";
import { t as ComboboxStore } from "../combobox-store-DEVQ45mZ.js";
import { Store } from "@ariakit/react-store";
import * as Core from "@ariakit/components/tab/tab-store";

//#region src/tab/tab-store.d.ts
declare function useTabStoreProps<T extends Core.TabStore>(store: T, update: () => void, props: TabStoreProps): T & {
  panels: import("@ariakit/components/collection/collection-store").CollectionStore<Core.TabStorePanel> & {
    useState: import("@ariakit/react-store").UseState<import("@ariakit/components/collection/collection-store").CollectionStoreState<Core.TabStorePanel>>;
  };
} & {
  composite: CompositeStore<CompositeStoreItem> | null | undefined;
  combobox: ComboboxStore<import("@ariakit/components/combobox/combobox-store").ComboboxStoreSelectedValue> | null | undefined;
};
/**
 * Creates a tab store to control the state of
 * [Tab](https://ariakit.com/components/tab) components.
 * @see https://ariakit.com/components/tab
 * @example
 * ```jsx
 * const tab = useTabStore();
 *
 * <TabList store={tab}>
 *   <Tab>Tab 1</Tab>
 *   <Tab>Tab 2</Tab>
 * </TabList>
 * <TabPanel store={tab}>Panel 1</TabPanel>
 * <TabPanel store={tab}>Panel 2</TabPanel>
 * ```
 */
declare function useTabStore(props?: TabStoreProps): TabStore;
interface TabStoreItem extends Core.TabStoreItem {}
interface TabStoreState extends Core.TabStoreState, CompositeStoreState<TabStoreItem> {}
interface TabStoreFunctions extends Pick<TabStoreOptions, "composite" | "combobox">, Omit<Core.TabStoreFunctions, "panels" | "composite" | "combobox">, CompositeStoreFunctions<TabStoreItem> {
  panels: Store<Core.TabStoreFunctions["panels"]>;
}
interface TabStoreOptions extends Omit<Core.TabStoreOptions, "composite" | "combobox">, CompositeStoreOptions<TabStoreItem> {
  /**
   * Function that will be called when the
   * [`selectedId`](https://ariakit.com/reference/tab-provider#selectedid) state
   * changes.
   *
   * Live examples:
   * - [Combobox with Tabs](https://ariakit.com/examples/combobox-tabs)
   * - [Select with Combobox and
   *   Tabs](https://ariakit.com/examples/select-combobox-tab)
   * - [Command Menu with
   *   Tabs](https://ariakit.com/examples/dialog-combobox-tab-command-menu)
   */
  setSelectedId?: (selectedId: TabStoreState["selectedId"]) => void;
  /**
   * A reference to another [composite
   * store](https://ariakit.com/reference/use-composite-store). This is
   * automatically set when rendering tabs as part of another composite widget,
   * such as [Combobox](https://ariakit.com/components/combobox) or
   * [Select](https://ariakit.com/components/select).
   *
   * Live examples:
   * - [Combobox with Tabs](https://ariakit.com/examples/combobox-tabs)
   */
  composite?: CompositeStore | null;
  /**
   * A reference to a [combobox
   * store](https://ariakit.com/reference/use-combobox-store). This is
   * automatically set when rendering tabs inside a
   * [Combobox](https://ariakit.com/components/combobox).
   *
   * Live examples:
   * - [Combobox with Tabs](https://ariakit.com/examples/combobox-tabs)
   */
  combobox?: ComboboxStore | null;
}
interface TabStoreProps extends TabStoreOptions, Omit<Core.TabStoreProps, "composite" | "combobox"> {}
interface TabStore extends TabStoreFunctions, Omit<Store<Core.TabStore>, "panels" | "composite" | "combobox"> {}
//#endregion
export { TabStore, TabStoreFunctions, TabStoreItem, TabStoreOptions, TabStoreProps, TabStoreState, useTabStore, useTabStoreProps };
//# sourceMappingURL=tab-store.d.ts.map