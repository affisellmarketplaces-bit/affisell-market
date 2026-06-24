import { CompositeGroupOptions } from "../composite/composite-group.js";
import { t as SelectStore } from "../select-store-BsLTAyKh.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/select/select-group.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `SelectGroup` component.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const store = useSelectStore();
 * const props = useSelectGroup({ store });
 * <Select store={store} />
 * <SelectPopover store={store}>
 *   <Role {...props}>
 *     <SelectGroupLabel>Fruits</SelectGroupLabel>
 *     <SelectItem value="Apple" />
 *     <SelectItem value="Orange" />
 *   </Role>
 * </SelectPopover>
 * ```
 */
declare const useSelectGroup: import("@ariakit/react-utils").Hook<"div", SelectGroupOptions<"div">>;
/**
 * Renders a group for [`SelectItem`](https://ariakit.com/reference/select-item)
 * elements. Optionally, a
 * [`SelectGroupLabel`](https://ariakit.com/reference/select-group-label) can be
 * rendered as a child to provide a label for the group.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx {4-8}
 * <SelectProvider>
 *   <Select />
 *   <SelectPopover>
 *     <SelectGroup>
 *       <SelectGroupLabel>Fruits</SelectGroupLabel>
 *       <SelectItem value="Apple" />
 *       <SelectItem value="Orange" />
 *     </SelectGroup>
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare const SelectGroup: (props: SelectGroupProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface SelectGroupOptions<T extends ElementType = TagName> extends CompositeGroupOptions<T> {
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
type SelectGroupProps<T extends ElementType = TagName> = Props<T, SelectGroupOptions<T>>;
//#endregion
export { SelectGroup, SelectGroupOptions, SelectGroupProps, useSelectGroup };
//# sourceMappingURL=select-group.d.ts.map