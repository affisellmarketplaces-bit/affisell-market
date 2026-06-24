import { CheckboxCheckOptions } from "../checkbox/checkbox-check.js";
import { t as SelectStore } from "../select-store-BsLTAyKh.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/select/select-item-check.d.ts
declare const TagName = "span";
type TagName = typeof TagName;
/**
 * Returns props to create a `SelectItemCheck` component. This hook must be used
 * in a component that's wrapped with `SelectItem` or the `checked` prop must be
 * explicitly passed to the component.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const props = useSelectItemCheck({ checked: true });
 * <Role {...props} />
 * ```
 */
declare const useSelectItemCheck: import("@ariakit/react-utils").Hook<"span", SelectItemCheckOptions<"span">>;
/**
 * Renders a checkmark icon when the
 * [`checked`](https://ariakit.com/reference/select-item-check#checked) prop is
 * `true`. The icon can be overridden by providing a different one as children.
 *
 * When rendered inside a
 * [`SelectItem`](https://ariakit.com/reference/select-item) component, the
 * [`checked`](https://ariakit.com/reference/select-item-check#checked) prop is
 * automatically derived from the context.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx {5,9}
 * <SelectProvider>
 *   <Select />
 *   <SelectPopover>
 *     <SelectItem value="Apple">
 *       <SelectItemCheck />
 *       Apple
 *     </SelectItem>
 *     <SelectItem value="Orange">
 *       <SelectItemCheck />
 *       Orange
 *     </SelectItem>
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare const SelectItemCheck: (props: SelectItemCheckProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface SelectItemCheckOptions<T extends ElementType = TagName> extends CheckboxCheckOptions<T> {
  /**
   * Object returned by the
   * [`useSelectStore`](https://ariakit.com/reference/use-select-store) hook.
   */
  store?: SelectStore;
}
type SelectItemCheckProps<T extends ElementType = TagName> = Props<T, SelectItemCheckOptions<T>>;
//#endregion
export { SelectItemCheck, SelectItemCheckOptions, SelectItemCheckProps, useSelectItemCheck };
//# sourceMappingURL=select-item-check.d.ts.map