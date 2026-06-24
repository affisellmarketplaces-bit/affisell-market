//#region src/hovercard/utils/polygon.d.ts
type Point = [number, number];
type Polygon = Point[];
declare function getEventPoint(event: MouseEvent): Point;
declare function isPointInPolygon(point: Point, polygon: Polygon): boolean;
declare function getElementPolygon(element: Element, enterPoint: Point): Point[];
//#endregion
export { Point, Polygon, getElementPolygon, getEventPoint, isPointInPolygon };
//# sourceMappingURL=polygon.d.ts.map