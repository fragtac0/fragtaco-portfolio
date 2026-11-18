export const TONE: { contrast: number; brightness: number; orange: number[] };
export function grey(r: number, g: number, b: number): number;
export function lift(v: number, p?: { contrast: number; brightness: number }): number;
export function tone(v: number, p?: { contrast: number; brightness: number; orange: number[] }): number[];
export function toneLut(p?: { contrast: number; brightness: number; orange: number[] }): Uint8Array;
