import { n as CompositeItemOptions } from "../composite-item-d4UXaZ84.js";
import { t as ToolbarStore } from "../toolbar-store-Cs-9cGHx.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/toolbar/toolbar-item.d.ts
declare const TagName = "button";
type TagName = typeof TagName;
/**
 * Returns props to create a `ToolbarItem` component.
 * @see https://ariakit.com/components/toolbar
 * @example
 * ```jsx
 * const store = useToolbarStore();
 * const props = useToolbarItem({ store });
 * <Toolbar store={store}>
 *   <Role {...props}>Item</Role>
 * </Toolbar>
 * ```
 */
declare const useToolbarItem: import("@ariakit/react-utils").Hook<"button", ToolbarItemOptions<"button">>;
/**
 * Renders an interactive element inside a
 * [`Toolbar`](https://ariakit.com/reference/toolbar).
 * @see https://ariakit.com/components/toolbar
 * @example
 * ```jsx {2}
 * <Toolbar>
 *   <ToolbarItem>Item</ToolbarItem>
 * </Toolbar>
 * ```
 */
declare const ToolbarItem: (props: ToolbarItemProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface ToolbarItemOptions<T extends ElementType = TagName> extends CompositeItemOptions<T> {
  /**
   * Object returned by the
   * [`useToolbarStore`](https://ariakit.com/reference/use-toolbar-store) hook.
   * If not provided, the closest
   * [`Toolbar`](https://ariakit.com/reference/toolbar) component's context will
   * be used.
   */
  store?: ToolbarStore;
}
type ToolbarItemProps<T extends ElementType = TagName> = Props<T, ToolbarItemOptions<T>>;
//#endregion
export { ToolbarItem, ToolbarItemOptions, ToolbarItemProps, useToolbarItem };
//# sourceMappingURL=toolbar-item.d.ts.map