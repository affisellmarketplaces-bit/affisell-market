import { n as FocusableOptions } from "../focusable-dBZH13-T.js";
import { t as HovercardStore } from "../hovercard-store-gIeoQEn_.js";
import { Props } from "@ariakit/react-utils";
import { ElementType, MouseEvent } from "react";
import { BooleanOrCallback } from "@ariakit/utils";

//#region src/hovercard/hovercard-anchor.d.ts
declare const TagName = "a";
type TagName = typeof TagName;
/**
 * Returns props to create a `HovercardAnchor` component.
 * @see https://ariakit.com/components/hovercard
 * @example
 * ```jsx
 * const store = useHovercardStore();
 * const props = useHovercardAnchor({ store });
 * <Role {...props} render={<a />}>@username</Role>
 * <Hovercard store={store}>Details</Hovercard>
 * ```
 */
declare const useHovercardAnchor: import("@ariakit/react-utils").Hook<"a", HovercardAnchorOptions<"a">>;
/**
 * Renders an anchor element that will open a
 * [`Hovercard`](https://ariakit.com/reference/hovercard) popup on hover.
 * @see https://ariakit.com/components/hovercard
 * @example
 * ```jsx {2}
 * <HovercardProvider>
 *   <HovercardAnchor>@username</HovercardAnchor>
 *   <Hovercard>Details</Hovercard>
 * </HovercardProvider>
 * ```
 */
declare const HovercardAnchor: (props: HovercardAnchorProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface HovercardAnchorOptions<T extends ElementType = TagName> extends FocusableOptions<T> {
  /**
   * Object returned by the
   * [`useHovercardStore`](https://ariakit.com/reference/use-hovercard-store)
   * hook. If not provided, the closest
   * [`HovercardProvider`](https://ariakit.com/reference/hovercard-provider)
   * component's context will be used.
   */
  store?: HovercardStore;
  /**
   * Shows the content element based on the user's _hover intent_ over the
   * anchor element. This behavior purposely ignores mobile touch and
   * unintentional mouse enter events, like those that happen during scrolling.
   *
   * Live examples:
   * - [Navigation Menubar](https://ariakit.com/examples/menubar-navigation)
   * - [Sliding Menu](https://ariakit.com/examples/menu-slide)
   * @default true
   */
  showOnHover?: BooleanOrCallback<MouseEvent<HTMLElement>>;
}
type HovercardAnchorProps<T extends ElementType = TagName> = Props<T, HovercardAnchorOptions<T>>;
//#endregion
export { HovercardAnchor, HovercardAnchorOptions, HovercardAnchorProps, useHovercardAnchor };
//# sourceMappingURL=hovercard-anchor.d.ts.map