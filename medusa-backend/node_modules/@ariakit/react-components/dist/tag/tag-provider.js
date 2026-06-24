"use client";
import { TagContextProvider } from "./tag-context.js";
import { useTagStore } from "./tag-store.js";
import { jsx } from "react/jsx-runtime";
//#region src/tag/tag-provider.tsx
/**
* Provides a tag store to [Tag](https://ariakit.com/components/tag) components.
* @see https://ariakit.com/components/tag
* @example
* ```jsx
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
function TagProvider(props = {}) {
	return /* @__PURE__ */ jsx(TagContextProvider, {
		value: useTagStore(props),
		children: props.children
	});
}
//#endregion
export { TagProvider };

//# sourceMappingURL=tag-provider.js.map