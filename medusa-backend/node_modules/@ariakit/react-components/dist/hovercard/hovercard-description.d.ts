import { t as HovercardStore } from "../hovercard-store-gIeoQEn_.js";
import { n as PopoverDescriptionOptions } from "../popover-description-DbW4mVBb.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/hovercard/hovercard-description.d.ts
declare const TagName = "p";
type TagName = typeof TagName;
/**
 * Returns props to create a `HovercardDescription` component. This hook must be
 * used in a component that's wrapped with `Hovercard` so the `aria-describedby`
 * prop is properly set on the hovercard element.
 * @see https://ariakit.com/components/hovercard
 * @example
 * ```jsx
 * // This component must be wrapped with Hovercard
 * const props = useHovercardDescription();
 * <Role {...props}>Description</Role>
 * ```
 */
declare const useHovercardDescription: import("@ariakit/react-utils").Hook<"p", HovercardDescriptionOptions<"p">>;
/**
 * Renders a description in a hovercard. This component must be wrapped within
 * [`Hovercard`](https://ariakit.com/reference/hovercard) so the
 * `aria-describedby` prop is properly set on the content element.
 * @see https://ariakit.com/components/hovercard
 * @example
 * ```jsx {3}
 * <HovercardProvider>
 *   <Hovercard>
 *     <HovercardDescription>Description</HovercardDescription>
 *   </Hovercard>
 * </HovercardProvider>
 * ```
 */
declare const HovercardDescription: (props: HovercardDescriptionProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface HovercardDescriptionOptions<T extends ElementType = TagName> extends PopoverDescriptionOptions<T> {
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
type HovercardDescriptionProps<T extends ElementType = TagName> = Props<T, HovercardDescriptionOptions<T>>;
//#endregion
export { HovercardDescription, HovercardDescriptionOptions, HovercardDescriptionProps, useHovercardDescription };
//# sourceMappingURL=hovercard-description.d.ts.map