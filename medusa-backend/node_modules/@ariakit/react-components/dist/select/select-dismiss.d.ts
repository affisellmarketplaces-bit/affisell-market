import { n as PopoverDismissOptions } from "../popover-dismiss-CQFvuLzJ.js";
import { t as SelectStore } from "../select-store-BsLTAyKh.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/select/select-dismiss.d.ts
declare const TagName = "button";
type TagName = typeof TagName;
/**
 * Returns props to create a `SelectDismiss` component.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx
 * const props = useSelectDismiss();
 * <Role.button {...props} />
 * ```
 */
declare const useSelectDismiss: import("@ariakit/react-utils").Hook<"button", SelectDismissOptions<"button">>;
/**
 * Renders a button that hides a
 * [`SelectPopover`](https://ariakit.com/reference/select-popover) component
 * when clicked.
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
 *     <SelectDismiss />
 *     <SelectList>
 *       <SelectItem value="Apple" />
 *       <SelectItem value="Orange" />
 *     </SelectList>
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
declare const SelectDismiss: (props: SelectDismissProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface SelectDismissOptions<T extends ElementType = TagName> extends PopoverDismissOptions<T> {
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
type SelectDismissProps<T extends ElementType = TagName> = Props<T, SelectDismissOptions<T>>;
//#endregion
export { SelectDismiss, SelectDismissOptions, SelectDismissProps, useSelectDismiss };
//# sourceMappingURL=select-dismiss.d.ts.map