import { a as PopoverStoreState, n as PopoverStoreFunctions, r as PopoverStoreOptions } from "../popover-store-DoCiTmUQ.js";
import { Store, StoreProps } from "@ariakit/store";

//#region src/composite/composite-overflow-store.d.ts
/**
 * Creates a compositeOverflow store.
 */
declare function createCompositeOverflowStore(props?: CompositeOverflowStoreProps): CompositeOverflowStore;
interface CompositeOverflowStoreState extends PopoverStoreState {}
interface CompositeOverflowStoreFunctions extends PopoverStoreFunctions {}
interface CompositeOverflowStoreOptions extends PopoverStoreOptions {}
interface CompositeOverflowStoreProps extends CompositeOverflowStoreOptions, StoreProps<CompositeOverflowStoreState> {}
interface CompositeOverflowStore extends CompositeOverflowStoreFunctions, Store<CompositeOverflowStoreState> {}
//#endregion
export { CompositeOverflowStore, CompositeOverflowStoreFunctions, CompositeOverflowStoreOptions, CompositeOverflowStoreProps, CompositeOverflowStoreState, createCompositeOverflowStore };
//# sourceMappingURL=composite-overflow-store.d.ts.map