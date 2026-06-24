import { CheckboxCheckOptions } from "../checkbox/checkbox-check.js";
import { t as MenuStore } from "../menu-store-BpTJdcL8.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/menu/menu-item-check.d.ts
declare const TagName = "span";
type TagName = typeof TagName;
/**
 * Returns props to create a `MenuItemCheck` component.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx
 * const props = useMenuItemCheck({ checked: true });
 * <Role {...props} />
 * ```
 */
declare const useMenuItemCheck: import("@ariakit/react-utils").Hook<"span", MenuItemCheckOptions<"span">>;
/**
 * Renders a checkmark icon when the
 * [`checked`](https://ariakit.com/reference/menu-item-check#checked) prop is
 * `true`. The icon can be overridden by providing a different one as children.
 *
 * When rendered inside
 * [`MenuItemCheckbox`](https://ariakit.com/reference/menu-item-checkbox) or
 * [`MenuItemRadio`](https://ariakit.com/reference/menu-item-radio) components,
 * the [`checked`](https://ariakit.com/reference/menu-item-check#checked) prop
 * is automatically derived from the context.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx {5,9}
 * <MenuProvider defaultValues={{ apple: true, orange: false }}>
 *   <MenuButton>Fruits</MenuButton>
 *   <Menu>
 *     <MenuItemCheckbox name="apple">
 *       <MenuItemCheck />
 *       Apple
 *     </MenuItemCheckbox>
 *     <MenuItemCheckbox name="orange">
 *       <MenuItemCheck />
 *       Orange
 *     </MenuItemCheckbox>
 *   </Menu>
 * </MenuProvider>
 * ```
 */
declare const MenuItemCheck: (props: MenuItemCheckProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface MenuItemCheckOptions<T extends ElementType = TagName> extends Omit<CheckboxCheckOptions<T>, "store"> {
  /**
   * Object returned by the
   * [`useMenuStore`](https://ariakit.com/reference/use-menu-store) hook.
   */
  store?: MenuStore;
}
type MenuItemCheckProps<T extends ElementType = TagName> = Props<T, MenuItemCheckOptions<T>>;
//#endregion
export { MenuItemCheck, MenuItemCheckOptions, MenuItemCheckProps, useMenuItemCheck };
//# sourceMappingURL=menu-item-check.d.ts.map