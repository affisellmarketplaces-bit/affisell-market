import { t as TagStore } from "../tag-store-xANOvuGo.js";
import { n as CompositeItemOptions } from "../composite-item-d4UXaZ84.js";
import { Props } from "@ariakit/react-utils";
import { ElementType, KeyboardEvent } from "react";
import { BooleanOrCallback } from "@ariakit/utils";

//#region src/tag/tag.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
type HTMLType = HTMLElementTagNameMap[TagName];
/**
 * Returns props to create a `Tag` component.
 * @see https://ariakit.com/components/tag
 * @example
 * ```jsx
 * const props = useTag();
 * <Role.div {...props} />
 * ```
 */
declare const useTag: import("@ariakit/react-utils").Hook<"div", TagOptions<"div">>;
/**
 * Renders a tag element inside a
 * [`TagList`](https://ariakit.com/reference/tag-list) wrapper.
 *
 * The user can remove the tag by pressing `Backspace` or `Delete` keys when the
 * tag is focused. The
 * [`removeOnKeyPress`](https://ariakit.com/reference/tag#removeonkeypress) prop
 * can be used to disable this behavior.
 *
 * When a printable key is pressed, the focus is automatically moved to the
 * input element.
 * @see https://ariakit.com/components/tag
 * @example
 * ```jsx {7-10}
 * <TagProvider>
 *   <TagListLabel>Invitees</TagListLabel>
 *   <TagList>
 *     <TagValues>
 *       {(values) =>
 *         values.map((value) => (
 *           <Tag key={value} value={value}>
 *             {value}
 *             <TagRemove />
 *           </Tag>
 *         ))
 *       }
 *     </TagValues>
 *     <TagInput />
 *   </TagList>
 * </TagProvider>
 * ```
 */
declare const Tag: (props: TagProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface TagOptions<T extends ElementType = TagName> extends CompositeItemOptions<T> {
  /**
   * Object returned by the
   * [`useTagStore`](https://ariakit.com/reference/use-tag-store) hook. If not
   * provided, the closest [`TagList`](https://ariakit.com/reference/tag-list)
   * component's context will be used.
   */
  store?: TagStore;
  /**
   * The unique value of the tag. This is automatically rendered as the tag's
   * content if no children are provided.
   */
  value: string;
  /**
   * Defines the behavior of the `Backspace` and `Delete` keys when the tag is
   * focused. If `true`, the tag is removed. If it's a function, it's invoked
   * with the key event and should return a boolean.
   * @default true
   */
  removeOnKeyPress?: BooleanOrCallback<KeyboardEvent<HTMLType>>;
}
type TagProps<T extends ElementType = TagName> = Props<T, TagOptions<T>>;
//#endregion
export { Tag, TagOptions, TagProps, useTag };
//# sourceMappingURL=tag.d.ts.map