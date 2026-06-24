import { a as MenubarStoreState, i as MenubarStoreProps, n as MenubarStoreFunctions, r as MenubarStoreOptions, t as MenubarStore } from "../menubar-store-C553OKBw.js";
import * as Core from "@ariakit/components/menu/menu-bar-store";

//#region src/menu/menu-bar-store.d.ts
declare function useMenuBarStoreProps<T extends Core.MenuBarStore>(store: T, update: () => void, props: MenuBarStoreProps): T;
/**
 * Creates a menu bar store.
 * @deprecated
 * Use [`useMenubarStore`](https://ariakit.com/reference/use-menubar-store)
 * instead.
 * @example
 * ```jsx
 * const menubar = useMenuBarStore();
 * <MenuBar store={menubar} />
 * ```
 */
declare function useMenuBarStore(props?: MenuBarStoreProps): MenuBarStore;
interface MenuBarStoreState extends MenubarStoreState {}
interface MenuBarStoreFunctions extends MenubarStoreFunctions {}
interface MenuBarStoreOptions extends MenubarStoreOptions {}
interface MenuBarStoreProps extends MenubarStoreProps {}
interface MenuBarStore extends MenubarStore {}
//#endregion
export { MenuBarStore, MenuBarStoreFunctions, MenuBarStoreOptions, MenuBarStoreProps, MenuBarStoreState, useMenuBarStore, useMenuBarStoreProps };
//# sourceMappingURL=menu-bar-store.d.ts.map