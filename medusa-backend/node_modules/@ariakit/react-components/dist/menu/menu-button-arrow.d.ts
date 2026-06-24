import { t as MenuStore } from "../menu-store-BpTJdcL8.js";
import { PopoverDisclosureArrowOptions } from "../popover/popover-disclosure-arrow.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/menu/menu-button-arrow.d.ts
declare const TagName = "span";
type TagName = typeof TagName;
/**
 * Returns props to create a `MenuButtonArrow` component.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx
 * const store = useMenuStore();
 * const props = useMenuButtonArrow({ store });
 * <MenuButton store={store}>
 *   Edit
 *   <Role {...props} />
 * </MenuButton>
 * <Menu store={store}>
 *   <MenuItem>Undo</MenuItem>
 *   <MenuItem>Redo</MenuItem>
 * </Menu>
 * ```
 */
declare const useMenuButtonArrow: import("@ariakit/react-utils").Hook<"span", MenuButtonArrowOptions<"span">>;
/**
 * Displays an arrow within a
 * [`MenuButton`](https://ariakit.com/reference/menu-button), pointing to the
 * [`Menu`](https://ariakit.com/reference/menu) position. It's typically based
 * on the [`placement`](https://ariakit.com/reference/menu-provider#placement)
 * state from the menu store, but this can be overridden with the
 * [`placement`](https://ariakit.com/reference/menu-button-arrow#placement)
 * prop.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx {4}
 * <MenuProvider placement="bottom-start">
 *   <MenuButton>
 *     Edit
 *     <MenuButtonArrow />
 *   </MenuButton>
 *   <Menu>
 *     <MenuItem>Undo</MenuItem>
 *     <MenuItem>Redo</MenuItem>
 *   </Menu>
 * </MenuProvider>
 * ```
 */
declare const MenuButtonArrow: (props: MenuButtonArrowProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface MenuButtonArrowOptions<T extends ElementType = TagName> extends PopoverDisclosureArrowOptions<T> {
  /**
   * Object returned by the
   * [`useMenuStore`](https://ariakit.com/reference/use-menu-store) hook. If not
   * provided, the closest
   * [`MenuButton`](https://ariakit.com/reference/menu-button) or
   * [`MenuProvider`](https://ariakit.com/reference/menu-provider) components'
   * context will be used.
   */
  store?: MenuStore;
}
type MenuButtonArrowProps<T extends ElementType = TagName> = Props<T, MenuButtonArrowOptions<T>>;
//#endregion
export { MenuButtonArrow, MenuButtonArrowOptions, MenuButtonArrowProps, useMenuButtonArrow };
//# sourceMappingURL=menu-button-arrow.d.ts.map