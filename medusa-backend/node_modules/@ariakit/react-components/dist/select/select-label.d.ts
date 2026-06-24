import { t as SelectStore } from "../select-store-BsLTAyKh.js";
import { Options, Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/select/select-label.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `SelectLabel` component. Since it's not a native
 * select element, we can't use the native label element. The `SelectLabel`
 * component will move focus and click on the `Select` component when the user
 * clicks on the label.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const store = useSelectStore();
 * const props = useSelectLabel({ store });
 * <Role {...props}>Favorite fruit</Role>
 * <Select store={store} />
 * ```
 */
declare const useSelectLabel: import("@ariakit/react-utils").Hook<"div", SelectLabelOptions<"div">>;
/**
 * Renders a label for the [`Select`](https://ariakit.com/reference/select)
 * component. Since it's not a native select element, we can't use the native
 * label element. This component will move focus and click on the
 * [`Select`](https://ariakit.com/reference/select) component when clicked.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx {2}
 * <SelectProvider defaultValue="Apple">
 *   <SelectLabel>Favorite fruit</SelectLabel>
 *   <Select />
 *   <SelectPopover>
 *     <SelectItem value="Apple" />
 *     <SelectItem value="Orange" />
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare const SelectLabel: (props: SelectLabelProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface SelectLabelOptions<_T extends ElementType = TagName> extends Options {
  /**
   * Object returned by the
   * [`useSelectStore`](https://ariakit.com/reference/use-select-store) hook. If
   * not provided, the closest
   * [`SelectProvider`](https://ariakit.com/reference/select-provider)
   * component's context will be used.
   */
  store?: SelectStore;
}
type SelectLabelProps<T extends ElementType = TagName> = Props<T, SelectLabelOptions<T>>;
//#endregion
export { SelectLabel, SelectLabelOptions, SelectLabelProps, useSelectLabel };
//# sourceMappingURL=select-label.d.ts.map