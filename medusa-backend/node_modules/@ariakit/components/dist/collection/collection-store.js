import { batch, createStore, init, setup, throwOnConflictingProps } from "@ariakit/store";
import { chain, defaultValue, getDocument, sortBasedOnDOMPosition } from "@ariakit/utils";
//#region src/collection/collection-store.ts
function getCommonParent(items) {
	const firstItem = items.find((item) => !!item.element);
	const lastElement = [...items].reverse().find((item) => !!item.element)?.element;
	let parentElement = firstItem?.element?.parentElement;
	if (!lastElement) return getDocument(parentElement).body;
	while (parentElement) {
		if (parentElement.contains(lastElement)) return parentElement;
		parentElement = parentElement.parentElement;
	}
	return getDocument(parentElement).body;
}
function getPrivateStore(store) {
	return store?.__unstablePrivateStore;
}
/**
* Creates a collection store.
*/
function createCollectionStore(props = {}) {
	throwOnConflictingProps(props, props.store);
	const syncState = props.store?.getState();
	const items = defaultValue(props.items, syncState?.items, props.defaultItems, []);
	const itemsMap = new Map(items.map((item) => [item.id, item]));
	const initialState = {
		items,
		renderedItems: defaultValue(syncState?.renderedItems, [])
	};
	const syncPrivateStore = getPrivateStore(props.store);
	const privateStore = createStore({
		items,
		renderedItems: initialState.renderedItems
	}, syncPrivateStore);
	const collection = createStore(initialState, props.store);
	const sortItems = (renderedItems) => {
		const sortedItems = sortBasedOnDOMPosition(renderedItems, (i) => i.element);
		privateStore.setState("renderedItems", sortedItems);
		collection.setState("renderedItems", sortedItems);
	};
	setup(collection, () => init(privateStore));
	setup(privateStore, () => {
		return batch(privateStore, ["items"], (state) => {
			collection.setState("items", state.items);
		});
	});
	setup(privateStore, () => {
		return batch(privateStore, ["renderedItems"], (state) => {
			let firstRun = true;
			let raf = requestAnimationFrame(() => {
				const { renderedItems } = collection.getState();
				if (state.renderedItems === renderedItems) return;
				sortItems(state.renderedItems);
			});
			if (typeof IntersectionObserver !== "function") return () => cancelAnimationFrame(raf);
			const ioCallback = () => {
				if (firstRun) {
					firstRun = false;
					return;
				}
				cancelAnimationFrame(raf);
				raf = requestAnimationFrame(() => sortItems(state.renderedItems));
			};
			const root = getCommonParent(state.renderedItems);
			const observer = new IntersectionObserver(ioCallback, { root });
			for (const item of state.renderedItems) {
				if (!item.element) continue;
				observer.observe(item.element);
			}
			return () => {
				cancelAnimationFrame(raf);
				observer.disconnect();
			};
		});
	});
	const mergeItem = (item, setItems, canDeleteFromMap = false) => {
		let prevItem;
		setItems((items) => {
			const index = items.findIndex(({ id }) => id === item.id);
			const nextItems = items.slice();
			if (index !== -1) {
				prevItem = items[index];
				const nextItem = {
					...prevItem,
					...item
				};
				nextItems[index] = nextItem;
				itemsMap.set(item.id, nextItem);
			} else {
				nextItems.push(item);
				itemsMap.set(item.id, item);
			}
			return nextItems;
		});
		const unmergeItem = () => {
			setItems((items) => {
				if (!prevItem) {
					if (canDeleteFromMap) itemsMap.delete(item.id);
					return items.filter(({ id }) => id !== item.id);
				}
				const index = items.findIndex(({ id }) => id === item.id);
				if (index === -1) return items;
				const nextItems = items.slice();
				nextItems[index] = prevItem;
				itemsMap.set(item.id, prevItem);
				return nextItems;
			});
		};
		return unmergeItem;
	};
	const registerItem = (item) => mergeItem(item, (getItems) => privateStore.setState("items", getItems), true);
	return {
		...collection,
		registerItem,
		renderItem: (item) => chain(registerItem(item), mergeItem(item, (getItems) => privateStore.setState("renderedItems", getItems))),
		item: (id) => {
			if (!id) return null;
			let item = itemsMap.get(id);
			if (!item) {
				const { items } = privateStore.getState();
				item = items.find((item) => item.id === id);
				if (item) itemsMap.set(id, item);
			}
			return item || null;
		},
		__unstablePrivateStore: privateStore
	};
}
//#endregion
export { createCollectionStore };

//# sourceMappingURL=collection-store.js.map