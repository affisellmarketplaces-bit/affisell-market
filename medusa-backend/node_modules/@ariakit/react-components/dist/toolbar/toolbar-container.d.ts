import { CompositeContainerOptions } from "../composite/composite-container.js";
import { ToolbarItemOptions } from "./toolbar-item.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/toolbar/toolbar-container.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `ToolbarContainer` component.
 * @see https://ariakit.com/components/toolbar
 * @example
 * ```jsx
 * const store = useToolbarStore();
 * const props = useToolbarContainer({ store });
 * <Toolbar store={store}>
 *   <Role {...props}>
 *     <input type="text" />
 *   </Role>
 * </Toolbar>
 * ```
 */
declare const useToolbarContainer: import("@ariakit/react-utils").Hook<"div", ToolbarContainerOptions<"div">>;
/**
 * Renders a toolbar item that may contain interactive widgets inside.
 * @see https://ariakit.com/components/toolbar
 * @example
 * ```jsx {2-4}
 * <Toolbar>
 *   <ToolbarContainer>
 *     <input type="text" />
 *   </ToolbarContainer>
 * </Toolbar>
 * ```
 */
declare const ToolbarContainer: (props: ToolbarContainerProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface ToolbarContainerOptions<T extends ElementType = TagName> extends ToolbarItemOptions<T>, Omit<CompositeContainerOptions<T>, "store"> {}
type ToolbarContainerProps<T extends ElementType = TagName> = Props<T, ToolbarContainerOptions<T>>;
//#endregion
export { ToolbarContainer, ToolbarContainerOptions, ToolbarContainerProps, useToolbarContainer };
//# sourceMappingURL=toolbar-container.d.ts.map