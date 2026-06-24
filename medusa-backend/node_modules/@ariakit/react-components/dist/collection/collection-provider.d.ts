import { a as CollectionStoreProps, r as CollectionStoreItem } from "../collection-store-CbwzYsWf.js";
import { ReactElement, ReactNode } from "react";
import { PickRequired } from "@ariakit/utils";

//#region src/collection/collection-provider.d.ts
/**
 * Provides a collection store to
 * [`CollectionItem`](https://ariakit.com/reference/collection-item) components.
 * @see https://ariakit.com/components/collection
 * @example
 * ```jsx
 * <CollectionProvider>
 *   <CollectionItem />
 *   <CollectionItem />
 *   <CollectionItem />
 * </CollectionProvider>
 * ```
 */
declare function CollectionProvider<T extends CollectionStoreItem = CollectionStoreItem>(props: PickRequired<CollectionProviderProps<T>, "items" | "defaultItems">): ReactElement;
declare function CollectionProvider(props?: CollectionProviderProps): ReactElement;
interface CollectionProviderProps<T extends CollectionStoreItem = CollectionStoreItem> extends CollectionStoreProps<T> {
  children?: ReactNode;
}
//#endregion
export { CollectionProvider, CollectionProviderProps };
//# sourceMappingURL=collection-provider.d.ts.map