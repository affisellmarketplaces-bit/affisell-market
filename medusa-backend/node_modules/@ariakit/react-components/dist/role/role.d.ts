import { Options, Props } from "@ariakit/react-utils";
import { ElementType, FC } from "react";

//#region src/role/role.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
declare const elements: readonly ["a", "button", "details", "dialog", "div", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "img", "input", "label", "li", "nav", "ol", "p", "section", "select", "span", "summary", "textarea", "ul", "svg"];
type RoleElements = { [K in (typeof elements)[number]]: FC<RoleProps<K>> };
/**
 * Returns props to create a `Role` component.
 * @see https://ariakit.com/components/role
 * @example
 * ```jsx
 * const props = useRole();
 * <Role {...props} />
 * ```
 */
declare const useRole: import("@ariakit/react-utils").Hook<"div", RoleOptions<"div">>;
/**
 * Renders an abstract element that supports the `render` prop and a
 * `wrapElement` prop that can be used to wrap the underlying element with React
 * Portal, Context or other component types.
 * @see https://ariakit.com/components/role
 * @example
 * ```jsx
 * <Role render={<div />} />
 * ```
 */
declare const Role: FC<RoleProps> & RoleElements;
interface RoleOptions<_T extends ElementType = TagName> extends Options {}
type RoleProps<T extends ElementType = TagName> = Props<T, RoleOptions<T>>;
//#endregion
export { Role, RoleOptions, RoleProps, useRole };
//# sourceMappingURL=role.d.ts.map