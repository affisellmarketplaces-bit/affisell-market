import { t as CompositeStore } from "../composite-store-DyJc-XRA.js";
import { n as SeparatorOptions } from "../separator-BnvSVwBa.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/composite/composite-separator.d.ts
declare const TagName = "hr";
type TagName = typeof TagName;
/**
 * Returns props to create a `CompositeSeparator` component.
 * @see https://ariakit.com/components/composite
 * @example
 * ```jsx
 * const store = useCompositeStore();
 * const props = useCompositeSeparator({ store });
 * <Composite store={store}>
 *   <CompositeItem>Item 1</CompositeItem>
 *   <Role {...props} />
 *   <CompositeItem>Item 2</CompositeItem>
 * </Composite>
 * ```
 */
declare const useCompositeSeparator: import("@ariakit/react-utils").Hook<"hr", CompositeSeparatorOptions<"hr">>;
/**
 * Renders a divider between
 * [`CompositeItem`](https://ariakit.com/reference/composite-item) elements.
 * @see https://ariakit.com/components/composite
 * @example
 * ```jsx {4}
 * <CompositeProvider>
 *   <Composite>
 *     <CompositeItem>Item 1</CompositeItem>
 *     <CompositeSeparator />
 *     <CompositeItem>Item 2</CompositeItem>
 *   </Composite>
 * </CompositeProvider>
 * ```
 */
declare const CompositeSeparator: (props: CompositeSeparatorProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface CompositeSeparatorOptions<T extends ElementType = TagName> extends SeparatorOptions<T> {
  /**
   * Object returned by the
   * [`useCompositeStore`](https://ariakit.com/reference/use-composite-store)
   * hook. If not provided, the closest
   * [`Composite`](https://ariakit.com/reference/composite) or
   * [`CompositeProvider`](https://ariakit.com/reference/composite-provider)
   * components' context will be used.
   */
  store?: CompositeStore;
  /**
   * The orientation of the separator. By default, this is the opposite of the
   * [`orientation`](https://ariakit.com/reference/composite-provider#orientation)
   * state of the composite widget. Which means it doesn't need to be explicitly
   * set in most cases.
   */
  orientation?: SeparatorOptions<T>["orientation"];
}
type CompositeSeparatorProps<T extends ElementType = TagName> = Props<T, CompositeSeparatorOptions<T>>;
//#endregion
export { CompositeSeparator, CompositeSeparatorOptions, CompositeSeparatorProps, useCompositeSeparator };
//# sourceMappingURL=composite-separator.d.ts.map