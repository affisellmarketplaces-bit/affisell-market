import { n as CompositeItemOptions } from "../composite-item-d4UXaZ84.js";
import { n as CompositeHoverOptions } from "../composite-hover-BpXq3T8J.js";
import { t as MenubarStore } from "../menubar-store-C553OKBw.js";
import { t as MenuStore } from "../menu-store-BpTJdcL8.js";
import { Props } from "@ariakit/react-utils";
import { ElementType, MouseEvent } from "react";
import { BooleanOrCallback } from "@ariakit/utils";

//#region src/menu/menu-item.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `MenuItem` component.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx
 * const store = useMenuStore();
 * const undo = useMenuItem({ store });
 * const redo = useMenuItem({ store });
 * <MenuButton store={store}>Edit</MenuButton>
 * <Menu store={store}>
 *   <Role {...undo}>Undo</Role>
 *   <Role {...redo}>Redo</Role>
 * </Menu>
 * ```
 */
declare const useMenuItem: import("@ariakit/react-utils").Hook<"div", MenuItemOptions<"div">>;
/**
 * Renders a menu item inside
 * [`MenuList`](https://ariakit.com/reference/menu-list) or
 * [`Menu`](https://ariakit.com/reference/menu)
 * components.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx {4-5}
 * <MenuProvider>
 *   <MenuButton>Edit</MenuButton>
 *   <Menu>
 *     <MenuItem>Undo</MenuItem>
 *     <MenuItem>Redo</MenuItem>
 *   </Menu>
 * </MenuProvider>
 * ```
 */
declare const MenuItem: (props: MenuItemProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface MenuItemOptions<T extends ElementType = TagName> extends CompositeItemOptions<T>, CompositeHoverOptions<T> {
  /**
   * Object returned by the
   * [`useMenuStore`](https://ariakit.com/reference/use-menu-store) or
   * [`useMenubarStore`](https://ariakit.com/reference/use-menubar-store)
   * hooks. If not provided, the closest
   * [`Menu`](https://ariakit.com/reference/menu),
   * [`MenuProvider`](https://ariakit.com/reference/menu-provider),
   * [`Menubar`](https://ariakit.com/reference/menubar), or
   * [`MenubarProvider`](https://ariakit.com/reference/menubar-provider)
   * components' context will be used.
   */
  store?: MenubarStore | MenuStore;
  /**
   * Determines if the menu should hide when this item is clicked.
   *
   * **Note**: This behavior isn't triggered if this menu item is rendered as a
   * link and modifier keys are used to either open the link in a new tab or
   * download it.
   *
   * Live examples:
   * - [Sliding Menu](https://ariakit.com/examples/menu-slide)
   * @default true
   */
  hideOnClick?: BooleanOrCallback<MouseEvent<HTMLElement>>;
}
type MenuItemProps<T extends ElementType = TagName> = Props<T, MenuItemOptions<T>>;
//#endregion
export { MenuItem, MenuItemOptions, MenuItemProps, useMenuItem };
//# sourceMappingURL=menu-item.d.ts.map