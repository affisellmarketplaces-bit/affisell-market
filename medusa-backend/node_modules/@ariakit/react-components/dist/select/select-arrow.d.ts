import { PopoverDisclosureArrowOptions } from "../popover/popover-disclosure-arrow.js";
import { t as SelectStore } from "../select-store-BsLTAyKh.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/select/select-arrow.d.ts
declare const TagName = "span";
type TagName = typeof TagName;
/**
 * Returns props to create a `SelectArrow` component.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const store = useSelectStore();
 * const props = useSelectArrow({ store });
 * <Select store={store}>
 *   {store.value}
 *   <Role {...props} />
 * </Select>
 * <SelectPopover store={store}>
 *   <SelectItem value="Apple" />
 *   <SelectItem value="Orange" />
 * </SelectPopover>
 * ```
 */
declare const useSelectArrow: import("@ariakit/react-utils").Hook<"span", SelectArrowOptions<"span">>;
/**
 * Renders an arrow pointing to the select popover position. It's usually
 * rendered inside the [`Select`](https://ariakit.com/reference/select)
 * component.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx {4}
 * <SelectProvider>
 *   <Select>
 *     {select.value}
 *     <SelectArrow />
 *   </Select>
 *   <SelectPopover>
 *     <SelectItem value="Apple" />
 *     <SelectItem value="Orange" />
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare const SelectArrow: (props: SelectArrowProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface SelectArrowOptions<T extends ElementType = TagName> extends PopoverDisclosureArrowOptions<T> {
  /**
   * Object returned by the
   * [`useSelectStore`](https://ariakit.com/reference/use-select-store) hook. If
   * not provided, the closest [`Select`](https://ariakit.com/reference/select)
   * or [`SelectProvider`](https://ariakit.com/reference/select-provider)
   * components' context will be used.
   */
  store?: SelectStore;
}
type SelectArrowProps<T extends ElementType = TagName> = Props<T, SelectArrowOptions<T>>;
//#endregion
export { SelectArrow, SelectArrowOptions, SelectArrowProps, useSelectArrow };
//# sourceMappingURL=select-arrow.d.ts.map