import { CompositeSeparatorOptions } from "../composite/composite-separator.js";
import { t as SelectStore } from "../select-store-BsLTAyKh.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/select/select-separator.d.ts
declare const TagName = "hr";
type TagName = typeof TagName;
/**
 * Returns props to create a `SelectSeparator` component.
 * @deprecated Use `useSelectGroup` with CSS borders instead.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const store = useSelectStore();
 * const props = useSelectSeparator({ store });
 * <SelectPopover store={store}>
 *   <SelectItem value="Item 1" />
 *   <Role {...props} />
 *   <SelectItem value="Item 2" />
 *   <SelectItem value="Item 3" />
 * </SelectPopover>
 * ```
 */
declare const useSelectSeparator: import("@ariakit/react-utils").Hook<"hr", SelectSeparatorOptions<"hr">>;
/**
 * Renders a divider between
 * [`SelectItem`](https://ariakit.com/reference/select-item) elements.
 * @deprecated Use [`SelectGroup`](https://ariakit.com/reference/select-group)
 * with CSS borders instead.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx {5}
 * <SelectProvider>
 *   <Select />
 *   <SelectPopover>
 *     <SelectItem value="Item 1" />
 *     <SelectSeparator />
 *     <SelectItem value="Item 2" />
 *     <SelectItem value="Item 3" />
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare const SelectSeparator: (props: SelectSeparatorProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface SelectSeparatorOptions<T extends ElementType = TagName> extends CompositeSeparatorOptions<T> {
  /**
   * Object returned by the
   * [`useSelectStore`](https://ariakit.com/reference/use-select-store) hook. If
   * not provided, the parent
   * [`SelectList`](https://ariakit.com/reference/select-list) or
   * [`SelectPopover`](https://ariakit.com/reference/select-popover) components'
   * context will be used.
   */
  store?: SelectStore;
}
type SelectSeparatorProps<T extends ElementType = TagName> = Props<T, SelectSeparatorOptions<T>>;
//#endregion
export { SelectSeparator, SelectSeparatorOptions, SelectSeparatorProps, useSelectSeparator };
//# sourceMappingURL=select-separator.d.ts.map