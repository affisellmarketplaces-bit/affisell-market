import { a as PopoverStoreState, n as PopoverStoreFunctions, r as PopoverStoreOptions } from "../popover-store-DoCiTmUQ.js";
import { Store, StoreOptions, StoreProps } from "@ariakit/store";
import { SetState } from "@ariakit/utils";

//#region src/hovercard/hovercard-store.d.ts
/**
 * Creates a hovercard store.
 */
declare function createHovercardStore(props?: HovercardStoreProps): HovercardStore;
interface HovercardStoreState extends PopoverStoreState {
  /** @default "bottom" */
  placement: PopoverStoreState["placement"];
  /**
   * The amount of time in milliseconds to wait before showing and hiding the
   * popup. To control the delay for showing and hiding separately, use
   * [`showTimeout`](https://ariakit.com/reference/hovercard-provider#showtimeout)
   * and
   * [`hideTimeout`](https://ariakit.com/reference/hovercard-provider#hidetimeout).
   * @default 500
   */
  timeout: number;
  /**
   * The amount of time in milliseconds to wait before _showing_ the popup. It
   * defaults to the value passed to
   * [`timeout`](https://ariakit.com/reference/hovercard-provider#timeout).
   *
   * Live examples:
   * - [Navigation Menubar](https://ariakit.com/examples/menubar-navigation)
   * - [Submenu with
   *   Combobox](https://ariakit.com/examples/menu-nested-combobox)
   */
  showTimeout?: number;
  /**
   * The amount of time in milliseconds to wait before _hiding_ the popup. It
   * defaults to the value passed to
   * [`timeout`](https://ariakit.com/reference/hovercard-provider#timeout).
   *
   * Live examples:
   * - [Navigation Menubar](https://ariakit.com/examples/menubar-navigation)
   * - [Tooltip with
   *   Motion](https://ariakit.com/examples/tooltip-framer-motion)
   */
  hideTimeout?: number;
  /**
   * Whether the popup or an element inside it should be focused when it is
   * shown.
   * @default false
   */
  autoFocusOnShow: boolean;
}
interface HovercardStoreFunctions extends PopoverStoreFunctions {
  /**
   * Sets the `autoFocusOnShow` state.
   *
   * Live examples:
   * - [Sliding Menu](https://ariakit.com/examples/menu-slide)
   */
  setAutoFocusOnShow: SetState<HovercardStoreState["autoFocusOnShow"]>;
}
interface HovercardStoreOptions extends StoreOptions<HovercardStoreState, "placement" | "timeout" | "showTimeout" | "hideTimeout">, PopoverStoreOptions {}
interface HovercardStoreProps extends HovercardStoreOptions, StoreProps<HovercardStoreState> {}
interface HovercardStore extends HovercardStoreFunctions, Store<HovercardStoreState> {}
//#endregion
export { HovercardStore, HovercardStoreFunctions, HovercardStoreOptions, HovercardStoreProps, HovercardStoreState, createHovercardStore };
//# sourceMappingURL=hovercard-store.d.ts.map