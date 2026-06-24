import { t as TagStore } from "../tag-store-xANOvuGo.js";
import { n as CompositeOptions } from "../composite-KBhCGLEy.js";
import { Props } from "@ariakit/react-utils";
import { ElementType } from "react";

//#region src/tag/tag-list-label.d.ts
declare const TagName = "label";
type TagName = typeof TagName;
/**
 * Returns props to create a `TagListLabel` component.
 * @see https://ariakit.com/components/tag
 * @example
 * ```jsx
 * const props = useTagListLabel();
 * <Role.label {...props} />
 * ```
 */
declare const useTagListLabel: import("@ariakit/react-utils").Hook<"label", TagListLabelOptions<"label">>;
/**
 * Renders a label element for the
 * [`TagInput`](https://ariakit.com/reference/tag-input) and also acts as the
 * accessible name for the listbox element rendered by
 * [`TagList`](https://ariakit.com/reference/tag-list).
 * @see https://ariakit.com/components/tag
 * @example
 * ```jsx {2}
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
declare const TagListLabel: (props: TagListLabelProps) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
interface TagListLabelOptions<T extends ElementType = TagName> extends CompositeOptions<T> {
  /**
   * Object returned by the
   * [`useTagStore`](https://ariakit.com/reference/use-tag-store) hook. If not
   * provided, the closest
   * [`TagProvider`](https://ariakit.com/reference/tag-provider) component's
   * context will be used.
   */
  store?: TagStore;
}
type TagListLabelProps<T extends ElementType = TagName> = Props<T, TagListLabelOptions<T>>;
//#endregion
export { TagListLabel, TagListLabelOptions, TagListLabelProps, useTagListLabel };
//# sourceMappingURL=tag-list-label.d.ts.map