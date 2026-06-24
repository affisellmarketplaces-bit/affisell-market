"use client";
import { useTagContext } from "./tag-context.js";
import { createElement, createHook, forwardRef, useId, useMergeRefs } from "@ariakit/react-utils";
import { invariant } from "@ariakit/utils";
import { useStoreState } from "@ariakit/react-store";
//#region src/tag/tag-list-label.tsx
const TagName = "label";
/**
* Returns props to create a `TagListLabel` component.
* @see https://ariakit.com/components/tag
* @example
* ```jsx
* const props = useTagListLabel();
* <Role.label {...props} />
* ```
*/
const useTagListLabel = createHook(function useTagListLabel({ store, ...props }) {
	const context = useTagContext();
	store = store || context;
	invariant(store, process.env.NODE_ENV !== "production" && "TagListLabel must receive a `store` prop or be wrapped in a TagProvider component.");
	const id = useId(props.id);
	props = {
		htmlFor: useStoreState(store, (state) => state.inputElement?.id),
		...props,
		id,
		ref: useMergeRefs(store.setLabelElement, props.ref)
	};
	return props;
});
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
const TagListLabel = forwardRef(function TagListLabel(props) {
	return createElement(TagName, useTagListLabel(props));
});
//#endregion
export { TagListLabel, useTagListLabel };

//# sourceMappingURL=tag-list-label.js.map