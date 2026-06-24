import { t as CheckboxStore } from "../checkbox-store-CYZPR4N4.js";
import { Options, Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/checkbox/checkbox-check.d.ts
declare const TagName = "span";
type TagName = typeof TagName;
/**
 * Returns props to create a `CheckboxCheck` component, that's usually rendered
 * inside a `Checkbox` component.
 * @see https://ariakit.com/components/checkbox
 * @example
 * ```jsx
 * const props = useCheckboxCheck({ checked: true });
 * <Role {...props} />
 * ```
 */
declare const useCheckboxCheck: import("@ariakit/react-utils").Hook<"span", CheckboxCheckOptions<"span">>;
/**
 * Renders a checkmark icon when the
 * [`checked`](https://ariakit.com/reference/checkbox-check#checked) prop is
 * `true`. The icon can be overridden by providing a different one as children.
 *
 * When rendered inside a [`Checkbox`](https://ariakit.com/reference/checkbox)
 * component, the
 * [`checked`](https://ariakit.com/reference/checkbox-check#checked) prop is
 * automatically derived from the context.
 * @see https://ariakit.com/components/checkbox
 * @example
 * ```jsx
 * <CheckboxCheck checked />
 * ```
 */
declare const CheckboxCheck: (props: CheckboxCheckProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface CheckboxCheckOptions<_T extends ElementType = TagName> extends Options {
  /**
   * Object returned by the
   * [`useCheckboxStore`](https://ariakit.com/reference/use-checkbox-store)
   * hook.
   */
  store?: CheckboxStore;
  /**
   * Determines if the checkmark should be rendered. This value is automatically
   * derived from the context when it exists. Manually setting this prop will
   * supersede the derived value.
   *
   * Live examples:
   * - [Submenu with
   *   Combobox](https://ariakit.com/examples/menu-nested-combobox)
   */
  checked?: boolean;
}
type CheckboxCheckProps<T extends ElementType = TagName> = Props<T, CheckboxCheckOptions<T>>;
//#endregion
export { CheckboxCheck, CheckboxCheckOptions, CheckboxCheckProps, useCheckboxCheck };
//# sourceMappingURL=checkbox-check.d.ts.map