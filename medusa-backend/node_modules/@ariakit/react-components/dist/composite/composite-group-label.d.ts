import { t as CompositeStore } from "../composite-store-DyJc-XRA.js";
import { n as GroupLabelOptions } from "../group-label-BKYqD4Sj.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/composite/composite-group-label.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `CompositeGroupLabel` component. This hook must be
 * used in a component that's wrapped with `CompositeGroup` so the
 * `aria-labelledby` prop is properly set on the composite group element.
 * @see https://ariakit.com/components/composite
 * @example
 * ```jsx
 * // This component must be wrapped with CompositeGroup
 * const props = useCompositeGroupLabel();
 * <Role {...props}>Label</Role>
 * ```
 */
declare const useCompositeGroupLabel: import("@ariakit/react-utils").Hook<"div", CompositeGroupLabelOptions<"div">>;
/**
 * Renders a label in a composite group. This component must be wrapped with
 * [`CompositeGroup`](https://ariakit.com/reference/composite-group) so the
 * `aria-labelledby` prop is properly set on the group element.
 * @see https://ariakit.com/components/composite
 * @example
 * ```jsx {4}
 * <CompositeProvider>
 *   <Composite>
 *     <CompositeGroup>
 *       <CompositeGroupLabel>Label</CompositeGroupLabel>
 *       <CompositeItem>Item 1</CompositeItem>
 *       <CompositeItem>Item 2</CompositeItem>
 *     </CompositeGroup>
 *   </Composite>
 * </CompositeProvider>
 * ```
 */
declare const CompositeGroupLabel: (props: CompositeGroupLabelProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface CompositeGroupLabelOptions<T extends ElementType = TagName> extends GroupLabelOptions<T> {
  /**
   * Object returned by the
   * [`useCompositeStore`](https://ariakit.com/reference/use-composite-store)
   * hook. If not provided, the closest
   * [`Composite`](https://ariakit.com/reference/composite) or
   * [`CompositeProvider`](https://ariakit.com/reference/composite-provider)
   * components' context will be used.
   */
  store?: CompositeStore;
}
type CompositeGroupLabelProps<T extends ElementType = TagName> = Props<T, CompositeGroupLabelOptions<T>>;
//#endregion
export { CompositeGroupLabel, CompositeGroupLabelOptions, CompositeGroupLabelProps, useCompositeGroupLabel };
//# sourceMappingURL=composite-group-label.d.ts.map