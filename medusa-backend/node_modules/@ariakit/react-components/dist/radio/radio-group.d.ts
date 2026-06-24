import { n as CompositeOptions } from "../composite-KBhCGLEy.js";
import { t as RadioStore } from "../radio-store-DOZ_1RSk.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/radio/radio-group.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `RadioGroup` component.
 * @see https://ariakit.com/components/radio
 * @example
 * ```jsx
 * const store = useRadioStore();
 * const props = useRadioGroup({ store });
 * <Role {...props}>
 *   <Radio value="Apple" />
 *   <Radio value="Orange" />
 * </Role>
 * ```
 */
declare const useRadioGroup: import("@ariakit/react-utils").Hook<"div", RadioGroupOptions<"div">>;
/**
 * Renders a [`radiogroup`](https://w3c.github.io/aria/#radiogroup) element that
 * manages a group of [`Radio`](https://ariakit.com/reference/radio) elements.
 * @see https://ariakit.com/components/radio
 * @example
 * ```jsx
 * <RadioProvider>
 *   <RadioGroup>
 *     <Radio value="Apple" />
 *     <Radio value="Orange" />
 *   </RadioGroup>
 * </RadioProvider>
 * ```
 */
declare const RadioGroup: (props: RadioGroupProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface RadioGroupOptions<T extends ElementType = TagName> extends CompositeOptions<T> {
  /**
   * Object returned by the
   * [`useRadioStore`](https://ariakit.com/reference/use-radio-store) hook. If
   * not provided, the closest
   * [`RadioProvider`](https://ariakit.com/reference/radio-provider) component's
   * context will be used.
   */
  store?: RadioStore;
}
type RadioGroupProps<T extends ElementType = TagName> = Props<T, RadioGroupOptions<T>>;
//#endregion
export { RadioGroup, RadioGroupOptions, RadioGroupProps, useRadioGroup };
//# sourceMappingURL=radio-group.d.ts.map