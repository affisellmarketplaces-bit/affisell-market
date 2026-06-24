import { t as TagStore } from "../tag-store-xANOvuGo.js";
import { n as CompositeOptions } from "../composite-KBhCGLEy.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/tag/tag-list.d.ts
declare const TagName = "div";
type TagName = typeof TagName;
/**
 * Returns props to create a `TagList` component.
 * @see https://ariakit.com/components/tag
 * @example
 * ```jsx
 * const props = useTagList();
 * <Role.div {...props} />
 * ```
 */
declare const useTagList: import("@ariakit/react-utils").Hook<"div", TagListOptions<"div">>;
/**
 * Renders a wrapper for [`Tag`](https://ariakit.com/reference/tag) and
 * [`TagInput`](https://ariakit.com/reference/tag-input) components. This
 * component is typically styled as an input field.
 *
 * The [`TagListLabel`](https://ariakit.com/reference/tag-list-label) component
 * can be used to provide an accessible name for the listbox element that owns
 * the tags.
 * @see https://ariakit.com/components/tag
 * @example
 * ```jsx {3-15}
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
declare const TagList: (props: TagListProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface TagListOptions<T extends ElementType = TagName> extends CompositeOptions<T> {
  /**
   * Object returned by the
   * [`useTagStore`](https://ariakit.com/reference/use-tag-store) hook. If not
   * provided, the closest
   * [`TagProvider`](https://ariakit.com/reference/tag-provider) component's
   * context will be used.
   */
  store?: TagStore;
}
type TagListProps<T extends ElementType = TagName> = Props<T, TagListOptions<T>>;
//#endregion
export { TagList, TagListOptions, TagListProps, useTagList };
//# sourceMappingURL=tag-list.d.ts.map