import { n as CompositeItemOptions } from "../composite-item-d4UXaZ84.js";
import { TabStore } from "./tab-store.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/tab/tab.d.ts
declare const TagName = "button";
type TagName = typeof TagName;
/**
 * Returns props to create a `Tab` component.
 * @see https://ariakit.com/components/tab
 * @example
 * ```jsx
 * const store = useTabStore();
 * const props = useTab({ store });
 * <TabList store={store}>
 *   <Role {...props}>Tab 1</Role>
 * </TabList>
 * <TabPanel store={store}>Panel 1</TabPanel>
 * ```
 */
declare const useTab: import("@ariakit/react-utils").Hook<"button", TabOptions<"button">>;
/**
 * Renders a tab element inside a
 * [`TabList`](https://ariakit.com/reference/tab-list) wrapper.
 * @see https://ariakit.com/components/tab
 * @example
 * ```jsx {3,4}
 * <TabProvider>
 *   <TabList>
 *     <Tab>Tab 1</Tab>
 *     <Tab>Tab 2</Tab>
 *   </TabList>
 *   <TabPanel>Panel 1</TabPanel>
 *   <TabPanel>Panel 2</TabPanel>
 * </TabProvider>
 * ```
 */
declare const Tab: (props: TabProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface TabOptions<T extends ElementType = TagName> extends CompositeItemOptions<T> {
  /**
   * Object returned by the
   * [`useTabStore`](https://ariakit.com/reference/use-tab-store) hook. If not
   * provided, the closest [`TabList`](https://ariakit.com/reference/tab-list)
   * component's context will be used.
   */
  store?: TabStore;
  /**
   * @default true
   */
  accessibleWhenDisabled?: CompositeItemOptions["accessibleWhenDisabled"];
}
type TabProps<T extends ElementType = TagName> = Props<T, TabOptions<T>>;
//#endregion
export { Tab, TabOptions, TabProps, useTab };
//# sourceMappingURL=tab.d.ts.map