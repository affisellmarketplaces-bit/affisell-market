import { AnyObject, SetStateAction } from "@ariakit/utils";

//#region src/index.d.ts
type Listener<S> = (state: S, prevState: S) => void | (() => void);
type Sync<S, K extends keyof S> = (keys: K[] | null, listener: Listener<Pick<S, K>>) => () => void;
type StoreSetup = (callback: () => void | (() => void)) => () => void;
type StoreInit = () => () => void;
type StoreSubscribe<S = State, K extends keyof S = keyof S> = Sync<S, K>;
type StoreSync<S = State, K extends keyof S = keyof S> = Sync<S, K>;
type StoreBatch<S = State, K extends keyof S = keyof S> = Sync<S, K>;
type StorePick<S = State, K extends ReadonlyArray<keyof S> = ReadonlyArray<keyof S>> = (keys: K) => Store<Pick<S, K[number]>>;
type StoreOmit<S = State, K extends ReadonlyArray<keyof S> = ReadonlyArray<keyof S>> = (keys: K) => Store<Omit<S, K[number]>>;
/**
 * Creates a store.
 * @param initialState Initial state.
 * @param stores Stores to extend.
 */
declare function createStore<S extends State>(initialState: S, ...stores: Array<Store<Partial<S>> | undefined>): Store<S>;
declare function setup<T extends Store>(store?: T | null, ...args: Parameters<StoreSetup>): T extends Store ? ReturnType<StoreSetup> : void;
declare function init<T extends Store>(store?: T | null, ...args: Parameters<StoreInit>): T extends Store ? ReturnType<StoreInit> : void;
declare function subscribe<T extends Store, K extends keyof StoreState<T>>(store?: T | null, ...args: Parameters<StoreSubscribe<StoreState<T>, K>>): T extends Store ? ReturnType<StoreSubscribe<StoreState<T>, K>> : void;
declare function sync<T extends Store, K extends keyof StoreState<T>>(store?: T | null, ...args: Parameters<StoreSync<StoreState<T>, K>>): T extends Store ? ReturnType<StoreSync<StoreState<T>, K>> : void;
declare function batch<T extends Store, K extends keyof StoreState<T>>(store?: T | null, ...args: Parameters<StoreBatch<StoreState<T>, K>>): T extends Store ? ReturnType<StoreBatch<StoreState<T>, K>> : void;
declare function omit<T extends Store, K extends ReadonlyArray<keyof StoreState<T>>>(store?: T | null, ...args: Parameters<StoreOmit<StoreState<T>, K>>): T extends Store ? ReturnType<StoreOmit<StoreState<T>, K>> : void;
declare function pick<T extends Store, K extends ReadonlyArray<keyof StoreState<T>>>(store?: T | null, ...args: Parameters<StorePick<StoreState<T>, K>>): T extends Store ? ReturnType<StorePick<StoreState<T>, K>> : void;
/**
 * Merges multiple stores into a single store.
 */
declare function mergeStore<S extends State>(...stores: Array<Store<S> | undefined>): Store<S>;
/**
 * Throws when a store prop is passed in conjunction with a default state.
 */
declare function throwOnConflictingProps(props: AnyObject, store?: Store): void;
/**
 * Store state type.
 */
type State = AnyObject;
/**
 * Initial state that can be passed to a store creator function.
 * @template S State type.
 * @template K Key type.
 */
type StoreOptions<S extends State, K extends keyof S> = Partial<Pick<S, K>>;
/**
 * Props that can be passed to a store creator function.
 * @template S State type.
 */
interface StoreProps<S extends State = State> {
  /**
   * Another store object that will be kept in sync with the original store.
   *
   * Live examples:
   * - [Navigation Menubar](https://ariakit.com/examples/menubar-navigation)
   */
  store?: Store<Partial<S>>;
}
/**
 * Extracts the state type from a store type.
 * @template T Store type.
 */
type StoreState<T> = T extends Store<infer S> ? S : never;
/**
 * Store.
 * @template S State type.
 */
interface Store<S = State> {
  /**
   * Returns the current store state.
   */
  getState(): S;
  /**
   * Sets a state value.
   */
  setState<K extends keyof S>(key: K, value: SetStateAction<S[K]>): void;
}
//#endregion
export { State, Store, StoreOptions, StoreProps, StoreState, batch, createStore, init, mergeStore, omit, pick, setup, subscribe, sync, throwOnConflictingProps };
//# sourceMappingURL=index.d.ts.map