import { n as DialogDisclosureOptions } from "../dialog-disclosure-DSESk5pv.js";
import { n as PopoverAnchorOptions } from "../popover-anchor-W18KUmuM.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/popover/popover-disclosure.d.ts
declare const TagName = "button";
type TagName = typeof TagName;
/**
 * Returns props to create a `PopoverDisclosure` component.
 * @see https://ariakit.com/components/popover
 * @example
 * ```jsx
 * const store = usePopoverStore();
 * const props = usePopoverDisclosure({ store });
 * <Role {...props}>Disclosure</Role>
 * <Popover store={store}>Popover</Popover>
 * ```
 */
declare const usePopoverDisclosure: import("@ariakit/react-utils").Hook<"button", PopoverDisclosureOptions<"button">>;
/**
 * Renders a button that controls the visibility of the
 * [`Popover`](https://ariakit.com/reference/popover) component when clicked.
 * @see https://ariakit.com/components/popover
 * @example
 * ```jsx {2}
 * <PopoverProvider>
 *   <PopoverDisclosure>Disclosure</PopoverDisclosure>
 *   <Popover>Popover</Popover>
 * </PopoverProvider>
 * ```
 */
declare const PopoverDisclosure: (props: PopoverDisclosureProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface PopoverDisclosureOptions<T extends ElementType = TagName> extends PopoverAnchorOptions<T>, Omit<DialogDisclosureOptions<T>, "store"> {}
type PopoverDisclosureProps<T extends ElementType = TagName> = Props<T, PopoverDisclosureOptions<T>>;
//#endregion
export { PopoverDisclosure, PopoverDisclosureOptions, PopoverDisclosureProps, usePopoverDisclosure };
//# sourceMappingURL=popover-disclosure.d.ts.map