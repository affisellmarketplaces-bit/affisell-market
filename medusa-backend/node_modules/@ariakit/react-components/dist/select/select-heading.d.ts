import { n as PopoverHeadingOptions } from "../popover-heading-DC8rYnwo.js";
import { t as SelectStore } from "../select-store-BsLTAyKh.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/select/select-heading.d.ts
declare const TagName = "h1";
type TagName = typeof TagName;
/**
 * Returns props to create a `SelectHeading` component.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const props = useSelectHeading();
 * <Role {...props}>Heading</Role>
 * ```
 */
declare const useSelectHeading: import("@ariakit/react-utils").Hook<"h1", SelectHeadingOptions<"h1">>;
/**
 * Renders a heading element that serves as a label for
 * [`SelectPopover`](https://ariakit.com/reference/select-popover) and
 * [`SelectList`](https://ariakit.com/reference/select-list) components.
 *
 * When this component is rendered within
 * [`SelectPopover`](https://ariakit.com/reference/select-popover), all
 * [`SelectItem`](https://ariakit.com/reference/select-item) elements must be
 * rendered within a [`SelectList`](https://ariakit.com/reference/select-list)
 * instead of directly within the popover.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx {4}
 * <SelectProvider>
 *   <Select />
 *   <SelectPopover>
 *     <SelectHeading>Fruits</SelectHeading>
 *     <SelectList>
 *       <SelectItem value="Apple" />
 *       <SelectItem value="Orange" />
 *     </SelectList>
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare const SelectHeading: (props: SelectHeadingProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface SelectHeadingOptions<T extends ElementType = TagName> extends PopoverHeadingOptions<T> {
  /**
   * Object returned by the
   * [`useSelectStore`](https://ariakit.com/reference/use-select-store) hook.
   * If not provided, the closest
   * [`Select`](https://ariakit.com/reference/select) or
   * [`SelectProvider`](https://ariakit.com/reference/select-provider)
   * components' context will be used.
   */
  store?: SelectStore;
}
type SelectHeadingProps<T extends ElementType = TagName> = Props<T, SelectHeadingOptions<T>>;
//#endregion
export { SelectHeading, SelectHeadingOptions, SelectHeadingProps, useSelectHeading };
//# sourceMappingURL=select-heading.d.ts.map