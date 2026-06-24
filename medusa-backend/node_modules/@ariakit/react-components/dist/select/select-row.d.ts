import { CompositeRowOptions } from "../composite/composite-row.js";
import { t as SelectStore } from "../select-store-BsLTAyKh.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/select/select-row.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `SelectRow` component.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const store = useSelectStore();
 * const props = useSelectRow({ store });
 * <SelectPopover store={store}>
 *   <Role {...props}>
 *     <SelectItem value="Apple" />
 *     <SelectItem value="Orange" />
 *   </Role>
 * </SelectPopover>
 * ```
 */
declare const useSelectRow: import("@ariakit/react-utils").Hook<"div", SelectRowOptions<"div">>;
/**
 * Renders a select row that allows two-dimensional arrow key navigation.
 * [`SelectItem`](https://ariakit.com/reference/select-item) elements wrapped
 * within this component will automatically receive a
 * [`rowId`](https://ariakit.com/reference/select-item#rowid) prop.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx {4-11}
 * <SelectProvider>
 *   <Select />
 *   <SelectPopover>
 *     <SelectRow>
 *       <SelectItem value="Apple" />
 *       <SelectItem value="Orange" />
 *     </SelectRow>
 *     <SelectRow>
 *       <SelectItem value="Banana" />
 *       <SelectItem value="Grape" />
 *     </SelectRow>
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare const SelectRow: (props: SelectRowProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface SelectRowOptions<T extends ElementType = TagName> extends CompositeRowOptions<T> {
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
type SelectRowProps<T extends ElementType = TagName> = Props<T, SelectRowOptions<T>>;
//#endregion
export { SelectRow, SelectRowOptions, SelectRowProps, useSelectRow };
//# sourceMappingURL=select-row.d.ts.map