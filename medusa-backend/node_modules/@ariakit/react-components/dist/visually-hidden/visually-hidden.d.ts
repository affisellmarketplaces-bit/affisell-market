import { Options, Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/visually-hidden/visually-hidden.d.ts
declare const TagName = "span";
type TagName = typeof TagName;
/**
 * Returns props to create a `VisuallyHidden` component. When applying the props
 * returned by this hook to a component, the component will be visually hidden,
 * but still accessible to screen readers.
 * @see https://ariakit.com/components/visually-hidden
 * @example
 * ```jsx
 * const props = useVisuallyHidden();
 * <a href="#">
 *   Learn more<Role {...props}> about the Solar System</Role>.
 * </a>
 * ```
 */
declare const useVisuallyHidden: import("@ariakit/react-utils").Hook<"span", VisuallyHiddenOptions<"span">>;
/**
 * Renders an element that's visually hidden, but still accessible to screen
 * readers.
 * @see https://ariakit.com/components/visually-hidden
 * @example
 * ```jsx
 * <a href="#">
 *   Learn more<VisuallyHidden> about the Solar System</VisuallyHidden>.
 * </a>
 * ```
 */
declare const VisuallyHidden: (props: VisuallyHiddenProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface VisuallyHiddenOptions<_T extends ElementType = TagName> extends Options {}
type VisuallyHiddenProps<T extends ElementType = TagName> = Props<T, VisuallyHiddenOptions<T>>;
//#endregion
export { VisuallyHidden, VisuallyHiddenOptions, VisuallyHiddenProps, useVisuallyHidden };
//# sourceMappingURL=visually-hidden.d.ts.map