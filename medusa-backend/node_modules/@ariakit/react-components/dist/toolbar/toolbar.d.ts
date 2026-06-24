import { n as CompositeOptions } from "../composite-KBhCGLEy.js";
import { i as ToolbarStoreProps, t as ToolbarStore } from "../toolbar-store-Cs-9cGHx.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/toolbar/toolbar.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `Toolbar` component.
 * @see https://ariakit.com/components/toolbar
 * @example
 * ```jsx
 * const store = useToolbarStore();
 * const props = useToolbar({ store });
 * <Role {...props}>
 *   <ToolbarItem>Item 1</ToolbarItem>
 *   <ToolbarItem>Item 2</ToolbarItem>
 * </Role>
 * ```
 */
declare const useToolbar: import("@ariakit/react-utils").Hook<"div", ToolbarOptions<"div">>;
/**
 * Renders a toolbar element that groups interactive elements together.
 * @see https://ariakit.com/components/toolbar
 * @example
 * ```jsx
 * <Toolbar>
 *   <ToolbarItem>Item 1</ToolbarItem>
 *   <ToolbarItem>Item 2</ToolbarItem>
 * </Toolbar>
 * ```
 */
declare const Toolbar: (props: ToolbarProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface ToolbarOptions<T extends ElementType = TagName> extends CompositeOptions<T>, Pick<ToolbarStoreProps, "focusLoop" | "orientation" | "rtl" | "virtualFocus"> {
  /**
   * Object returned by the
   * [`useToolbarStore`](https://ariakit.com/reference/use-toolbar-store) hook.
   * If not provided, the closest
   * [`ToolbarProvider`](https://ariakit.com/reference/toolbar-provider)
   * component context will be used. If the component is not wrapped in a
   * [`ToolbarProvider`](https://ariakit.com/reference/toolbar-provider)
   * component, an internal store will be used.
   */
  store?: ToolbarStore;
}
type ToolbarProps<T extends ElementType = TagName> = Props<T, ToolbarOptions<T>>;
//#endregion
export { Toolbar, ToolbarOptions, ToolbarProps, useToolbar };
//# sourceMappingURL=toolbar.d.ts.map