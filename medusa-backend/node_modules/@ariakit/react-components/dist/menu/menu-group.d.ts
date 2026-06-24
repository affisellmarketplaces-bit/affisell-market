import { CompositeGroupOptions } from "../composite/composite-group.js";
import { t as MenuStore } from "../menu-store-BpTJdcL8.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/menu/menu-group.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `MenuGroup` component.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx
 * const store = useMenuStore();
 * const props = useMenuGroup({ store });
 * <MenuButton store={store}>Recent Items</MenuButton>
 * <Menu store={store}>
 *   <Role {...props}>
 *     <MenuGroupLabel>Applications</MenuGroupLabel>
 *     <MenuItem>Google Chrome.app</MenuItem>
 *     <MenuItem>Safari.app</MenuItem>
 *   </Role>
 * </Menu>
 * ```
 */
declare const useMenuGroup: import("@ariakit/react-utils").Hook<"div", MenuGroupOptions<"div">>;
/**
 * Renders a group for [`MenuItem`](https://ariakit.com/reference/menu-item)
 * elements. Optionally, a
 * [`MenuGroupLabel`](https://ariakit.com/reference/menu-group-label) can be
 * rendered as a child to provide a label for the group.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx {4-8}
 * <MenuProvider>
 *   <MenuButton>Recent Items</MenuButton>
 *   <Menu>
 *     <MenuGroup>
 *       <MenuGroupLabel>Applications</MenuGroupLabel>
 *       <MenuItem>Google Chrome.app</MenuItem>
 *       <MenuItem>Safari.app</MenuItem>
 *     </MenuGroup>
 *   </Menu>
 * </MenuProvider>
 * ```
 */
declare const MenuGroup: (props: MenuGroupProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface MenuGroupOptions<T extends ElementType = TagName> extends CompositeGroupOptions<T> {
  /**
   * Object returned by the
   * [`useMenuStore`](https://ariakit.com/reference/use-menu-store) hook. If not
   * provided, the closest [`Menu`](https://ariakit.com/reference/menu) or
   * [`MenuProvider`](https://ariakit.com/reference/menu-provider) components'
   * context will be used.
   */
  store?: MenuStore;
}
type MenuGroupProps<T extends ElementType = TagName> = Props<T, MenuGroupOptions<T>>;
//#endregion
export { MenuGroup, MenuGroupOptions, MenuGroupProps, useMenuGroup };
//# sourceMappingURL=menu-group.d.ts.map