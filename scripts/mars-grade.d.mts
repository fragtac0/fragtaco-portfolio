export interface RampStop {
  at: number;
  rgb: [number, number, number];
}
export interface CurveParams {
  black: number;
  white: number;
  gamma: number;
}
export const STOPS: RampStop[];
export const GRADE: CurveParams;
export function ramp(v: number): [number, number, number];
export function curve(v: number, params: CurveParams): number;
export function gradeLut(params?: CurveParams): Uint8Array;
