import { PopoverDisclosureOptions } from "../popover/popover-disclosure.js";
import { n as CompositeTypeaheadOptions } from "../composite-typeahead-0euW43GU.js";
import { HovercardAnchorOptions } from "../hovercard/hovercard-anchor.js";
import { t as MenuStore } from "../menu-store-BpTJdcL8.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/menu/menu-button.d.ts
declare const TagName = "button";
type TagName = typeof TagName | "div";
/**
 * Returns props to create a `MenuButton` component.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx
 * const store = useMenuStore();
 * const props = useMenuButton({ store });
 * <Role {...props}>Edit</Role>
 * <Menu store={store}>
 *   <MenuItem>Undo</MenuItem>
 *   <MenuItem>Redo</MenuItem>
 * </Menu>
 * ```
 */
declare const useMenuButton: import("@ariakit/react-utils").Hook<TagName, MenuButtonOptions<TagName>>;
/**
 * Renders a menu button that toggles the visibility of a
 * [`Menu`](https://ariakit.com/reference/menu) component when clicked or when
 * using arrow keys.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx {2}
 * <MenuProvider>
 *   <MenuButton>Edit</MenuButton>
 *   <Menu>
 *     <MenuItem>Undo</MenuItem>
 *     <MenuItem>Redo</MenuItem>
 *   </Menu>
 * </MenuProvider>
 * ```
 */
declare const MenuButton: (props: MenuButtonProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface MenuButtonOptions<T extends ElementType = TagName> extends HovercardAnchorOptions<T>, PopoverDisclosureOptions<T>, CompositeTypeaheadOptions<T> {
  /**
   * Object returned by the
   * [`useMenuStore`](https://ariakit.com/reference/use-menu-store) hook. If not
   * provided, the closest
   * [`MenuProvider`](https://ariakit.com/reference/menu-provider) component's
   * context will be used.
   */
  store?: MenuStore;
  /**
   * Determines whether pressing a character key while focusing on the
   * [`MenuButton`](https://ariakit.com/reference/menu-button) should move focus
   * to the [`MenuItem`](https://ariakit.com/reference/menu-item) starting with
   * that character.
   *
   * By default, it's `true` for menu buttons in a
   * [`Menubar`](https://ariakit.com/reference/menubar), but `false` for other
   * menu buttons.
   */
  typeahead?: boolean;
}
type MenuButtonProps<T extends ElementType = TagName> = Props<T, MenuButtonOptions<T>>;
//#endregion
export { MenuButton, MenuButtonOptions, MenuButtonProps, useMenuButton };
//# sourceMappingURL=menu-button.d.ts.map