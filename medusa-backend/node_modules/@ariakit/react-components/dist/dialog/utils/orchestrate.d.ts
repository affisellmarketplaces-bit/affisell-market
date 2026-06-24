//#region src/dialog/utils/orchestrate.d.ts
declare function orchestrate(element: Element, key: string, setup: () => () => void): () => void;
declare function setAttribute(element: Element, attr: string, value: string): () => void;
declare function setProperty<T extends Element, K extends keyof T & string>(element: T, property: K, value: T[K]): () => void;
declare function assignStyle(element: HTMLElement | null | undefined, style: Partial<CSSStyleDeclaration>): () => void;
declare function setCSSProperty(element: HTMLElement | null | undefined, property: string, value: string): () => void;
//#endregion
export { assignStyle, orchestrate, setAttribute, setCSSProperty, setProperty };
//# sourceMappingURL=orchestrate.d.ts.map