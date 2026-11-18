export const UNITS_PER_DEG: number;
export const FRAME: { west: number; north: number; lonSpan: number; latSpan: number; unitsPerDeg: number };
export const HEIGHTS: { west: number; north: number; lonSpan: number; latSpan: number };
export const SUMMIT: { lon: number; lat: number };
export function xOf(lon: number): number;
export function yOf(lat: number): number;
export function lonOf(x: number): number;
export function latOf(y: number): number;
export function boundsOf(f: { west: number; north: number; lonSpan: number; latSpan: number }): {
  west: number;
  east: number;
  north: number;
  south: number;
};
export function pxPerDeg(z: number): number;
export function tileRange(
  f: { west: number; north: number; lonSpan: number; latSpan: number },
  z: number,
): { cols: [number, number]; rows: [number, number]; left: number; top: number; width: number; height: number };
