import { CheckboxCheckOptions } from "../checkbox/checkbox-check.js";
import { t as ComboboxStore } from "../combobox-store-DEVQ45mZ.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/combobox/combobox-item-check.d.ts
declare const TagName = "span";
type TagName = typeof TagName;
/**
 * Returns props to create a `ComboboxItemCheck` component. This hook must be
 * used in a component that's wrapped with `ComboboxItem` or the `checked` prop
 * must be explicitly passed to the component.
 * @see https://ariakit.com/components/combobox
 * @example
 * ```jsx
 * const props = useComboboxItemCheck({ checked: true });
 * <Role {...props} />
 * ```
 */
declare const useComboboxItemCheck: import("@ariakit/react-utils").Hook<"span", ComboboxItemCheckOptions<"span">>;
/**
 * Renders a checkmark icon when the
 * [`checked`](https://ariakit.com/reference/combobox-item-check#checked) prop
 * is `true`. The icon can be overridden by providing a different one as
 * children.
 *
 * When rendered inside a
 * [`ComboboxItem`](https://ariakit.com/reference/combobox-item) component, the
 * [`checked`](https://ariakit.com/reference/combobox-item-check#checked) prop
 * is automatically derived from the context.
 * @see https://ariakit.com/components/combobox
 * @example
 * ```jsx {5,9}
 * <ComboboxProvider>
 *   <Combobox />
 *   <ComboboxPopover>
 *     <ComboboxItem value="Apple">
 *       <ComboboxItemCheck />
 *       Apple
 *     </ComboboxItem>
 *     <ComboboxItem value="Orange">
 *       <ComboboxItemCheck />
 *       Orange
 *     </ComboboxItem>
 *   </ComboboxPopover>
 * </ComboboxProvider>
 * ```
 */
declare const ComboboxItemCheck: (props: ComboboxItemCheckProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface ComboboxItemCheckOptions<T extends ElementType = TagName> extends CheckboxCheckOptions<T> {
  /**
   * Object returned by the
   * [`useComboboxStore`](https://ariakit.com/reference/use-combobox-store)
   * hook.
   */
  store?: ComboboxStore;
}
type ComboboxItemCheckProps<T extends ElementType = TagName> = Props<T, ComboboxItemCheckOptions<T>>;
//#endregion
export { ComboboxItemCheck, ComboboxItemCheckOptions, ComboboxItemCheckProps, useComboboxItemCheck };
//# sourceMappingURL=combobox-item-check.d.ts.map