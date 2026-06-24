import { t as PopoverStore } from "./popover-store-Bc-l5VVO.js";
import { n as DialogDescriptionOptions } from "./dialog-description-CJGxnEvk.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/popover/popover-description.d.ts
declare const TagName = "p";
type TagName = typeof TagName;
/**
 * Returns props to create a `PopoverDescription` component. This hook must be
 * used in a component that's wrapped with `Popover` so the `aria-describedby`
 * prop is properly set on the popover element.
 * @see https://ariakit.com/components/popover
 * @example
 * ```jsx
 * // This component must be wrapped with Popover
 * const props = usePopoverDescription();
 * <Role {...props}>Description</Role>
 * ```
 */
declare const usePopoverDescription: import("@ariakit/react-utils").Hook<"p", PopoverDescriptionOptions<"p">>;
/**
 * Renders a description in a popover. This component must be wrapped with
 * [`Popover`](https://ariakit.com/reference/popover) so the `aria-describedby`
 * prop is properly set on the popover element.
 * @see https://ariakit.com/components/popover
 * @example
 * ```jsx {3}
 * <PopoverProvider>
 *   <Popover>
 *     <PopoverDescription>Description</PopoverDescription>
 *   </Popover>
 * </PopoverProvider>
 * ```
 */
declare const PopoverDescription: (props: PopoverDescriptionProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface PopoverDescriptionOptions<T extends ElementType = TagName> extends DialogDescriptionOptions<T> {
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
type PopoverDescriptionProps<T extends ElementType = TagName> = Props<T, PopoverDescriptionOptions<T>>;
//#endregion
export { usePopoverDescription as i, PopoverDescriptionOptions as n, PopoverDescriptionProps as r, PopoverDescription as t };
//# sourceMappingURL=popover-description-DbW4mVBb.d.ts.map