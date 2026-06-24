import { t as HovercardStore } from "../hovercard-store-gIeoQEn_.js";
import { n as PopoverHeadingOptions } from "../popover-heading-DC8rYnwo.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/hovercard/hovercard-heading.d.ts
declare const TagName = "h1";
type TagName = typeof TagName;
/**
 * Returns props to create a `HovercardHeading` component. This hook must be
 * used in a component that's wrapped with `Hovercard` so the `aria-labelledby`
 * prop is properly set on the hovercard element.
 * @see https://ariakit.com/components/hovercard
 * @example
 * ```jsx
 * // This component must be wrapped with Hovercard
 * const props = useHovercardHeading();
 * <Role {...props}>Heading</Role>
 * ```
 */
declare const useHovercardHeading: import("@ariakit/react-utils").Hook<"h1", HovercardHeadingOptions<"h1">>;
/**
 * Renders a heading in a hovercard. This component must be wrapped within
 * [`Hovercard`](https://ariakit.com/reference/hovercard) so the
 * `aria-labelledby` prop is properly set on the content element.
 * @see https://ariakit.com/components/hovercard
 * @example
 * ```jsx {3}
 * <HovercardProvider>
 *   <Hovercard>
 *     <HovercardHeading>Heading</HovercardHeading>
 *   </Hovercard>
 * </HovercardProvider>
 * ```
 */
declare const HovercardHeading: (props: HovercardHeadingProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface HovercardHeadingOptions<T extends ElementType = TagName> extends PopoverHeadingOptions<T> {
  /**
   * Object returned by the
   * [`useHovercardStore`](https://ariakit.com/reference/use-hovercard-store)
   * hook. If not provided, the closest
   * [`Hovercard`](https://ariakit.com/reference/hovercard) or
   * [`HovercardProvider`](https://ariakit.com/reference/hovercard-provider)
   * components' context will be used.
   */
  store?: HovercardStore;
}
type HovercardHeadingProps<T extends ElementType = TagName> = Props<T, HovercardHeadingOptions<T>>;
//#endregion
export { HovercardHeading, HovercardHeadingOptions, HovercardHeadingProps, useHovercardHeading };
//# sourceMappingURL=hovercard-heading.d.ts.map