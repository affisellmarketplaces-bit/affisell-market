import { t as PopoverStore } from "./popover-store-Bc-l5VVO.js";
import { n as DialogHeadingOptions } from "./dialog-heading-DGA5d8VH.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/popover/popover-heading.d.ts
declare const TagName = "h1";
type TagName = typeof TagName;
/**
 * Returns props to create a `PopoverHeading` component. This hook must be used
 * in a component that's wrapped with `Popover` so the `aria-labelledby` prop is
 * properly set on the popover element.
 * @see https://ariakit.com/components/popover
 * @example
 * ```jsx
 * // This component must be wrapped with Popover
 * const props = usePopoverHeading();
 * <Role {...props}>Heading</Role>
 * ```
 */
declare const usePopoverHeading: import("@ariakit/react-utils").Hook<"h1", PopoverHeadingOptions<"h1">>;
/**
 * Renders a heading in a popover. This component must be wrapped with
 * [`Popover`](https://ariakit.com/reference/popover) so the `aria-labelledby`
 * prop is properly set on the popover element.
 * @see https://ariakit.com/components/popover
 * @example
 * ```jsx {3}
 * <PopoverProvider>
 *   <Popover>
 *     <PopoverHeading>Heading</PopoverHeading>
 *   </Popover>
 * </PopoverProvider>
 * ```
 */
declare const PopoverHeading: (props: PopoverHeadingProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface PopoverHeadingOptions<T extends ElementType = TagName> extends DialogHeadingOptions<T> {
  /**
   * Object returned by the
   * [`usePopoverStore`](https://ariakit.com/reference/use-popover-store) hook.
   * If not provided, the closest
   * [`Popover`](https://ariakit.com/reference/popover) or
   * [`PopoverProvider`](https://ariakit.com/reference/popover-provider)
   * components' context will be used.
   */
  store?: PopoverStore;
}
type PopoverHeadingProps<T extends ElementType = TagName> = Props<T, PopoverHeadingOptions<T>>;
//#endregion
export { usePopoverHeading as i, PopoverHeadingOptions as n, PopoverHeadingProps as r, PopoverHeading as t };
//# sourceMappingURL=popover-heading-DC8rYnwo.d.ts.map