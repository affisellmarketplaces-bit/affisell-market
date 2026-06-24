"use client";
import { addGlobalEventListener } from "@ariakit/utils";
import { useEffect, useRef } from "react";
//#region src/dialog/utils/use-previous-mouse-down-ref.ts
function usePreviousMouseDownRef(enabled, scope) {
	const previousMouseDownRef = useRef(null);
	useEffect(() => {
		if (!enabled) {
			previousMouseDownRef.current = null;
			return;
		}
		const onMouseDown = (event) => {
			previousMouseDownRef.current = event.target;
		};
		return addGlobalEventListener("mousedown", onMouseDown, true, scope);
	}, [enabled, scope]);
	return previousMouseDownRef;
}
//#endregion
export { usePreviousMouseDownRef };

//# sourceMappingURL=use-previous-mouse-down-ref.js.map