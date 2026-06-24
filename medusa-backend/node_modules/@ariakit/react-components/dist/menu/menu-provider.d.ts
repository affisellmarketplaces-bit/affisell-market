import { i as MenuStoreProps, o as MenuStoreValues } from "../menu-store-BpTJdcL8.js";
import { ReactElement, ReactNode } from "react";
import { PickRequired } from "@ariakit/utils";

//#region src/menu/menu-provider.d.ts
type Values = MenuStoreValues;
/**
 * Provides a menu store to [Menu](https://ariakit.com/components/menu)
 * components.
 * @see https://ariakit.com/components/menu
 * @example
 * ```jsx
 * <MenuProvider placement="top">
 *   <MenuButton>Edit</MenuButton>
 *   <Menu>
 *     <MenuItem>Undo</MenuItem>
 *     <MenuItem>Redo</MenuItem>
 *   </Menu>
 * </MenuProvider>
 * ```
 */
declare function MenuProvider<T extends Values = Values>(props: PickRequired<MenuProviderProps<T>, "values" | "defaultValues">): ReactElement;
declare function MenuProvider(props?: MenuProviderProps): ReactElement;
interface MenuProviderProps<T extends Values = Values> extends MenuStoreProps<T> {
  children?: ReactNode;
}
//#endregion
export { MenuProvider, MenuProviderProps };
//# sourceMappingURL=menu-provider.d.ts.map