import { t as ComboboxStore } from "../combobox-store-DEVQ45mZ.js";
import { CompositeGroupLabelOptions } from "../composite/composite-group-label.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/combobox/combobox-group-label.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `ComboboxGroupLabel` component. This hook should be
 * used in a component that's wrapped with `ComboboxGroup` so the
 * `aria-labelledby` is correctly set on the combobox group element.
 * @see https://ariakit.com/components/combobox
 * @example
 * ```jsx
 * // This component should be wrapped with ComboboxGroup
 * const props = useComboboxGroupLabel();
 * <Role {...props}>Label</Role>
 * ```
 */
declare const useComboboxGroupLabel: import("@ariakit/react-utils").Hook<"div", ComboboxGroupLabelOptions<"div">>;
/**
 * Renders a label in a combobox group. This component should be wrapped with
 * [`ComboboxGroup`](https://ariakit.com/reference/combobox-group) so the
 * `aria-labelledby` is correctly set on the group element.
 * @see https://ariakit.com/components/combobox
 * @example
 * ```jsx {5}
 * <ComboboxProvider>
 *   <Combobox />
 *   <ComboboxPopover>
 *     <ComboboxGroup>
 *       <ComboboxGroupLabel>Fruits</ComboboxGroupLabel>
 *       <ComboboxItem value="Apple" />
 *       <ComboboxItem value="Banana" />
 *     </ComboboxGroup>
 *   </ComboboxPopover>
 * </ComboboxProvider>
 * ```
 */
declare const ComboboxGroupLabel: (props: ComboboxGroupLabelProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface ComboboxGroupLabelOptions<T extends ElementType = TagName> extends CompositeGroupLabelOptions<T> {
  /**
   * Object returned by the
   * [`useComboboxStore`](https://ariakit.com/reference/use-combobox-store)
   * hook. If not provided, the closest
   * [`ComboboxList`](https://ariakit.com/reference/combobox-list) or
   * [`ComboboxPopover`](https://ariakit.com/reference/combobox-popover)
   * components' context will be used.
   */
  store?: ComboboxStore;
}
type ComboboxGroupLabelProps<T extends ElementType = TagName> = Props<T, ComboboxGroupLabelOptions<T>>;
//#endregion
export { ComboboxGroupLabel, ComboboxGroupLabelOptions, ComboboxGroupLabelProps, useComboboxGroupLabel };
//# sourceMappingURL=combobox-group-label.d.ts.map