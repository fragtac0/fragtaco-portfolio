/**
 * WCAG contrast of two `#rrggbb` colours (relative luminance of sRGB, the ratio (L1 + 0.05) / (L2 + 0.05)). Pure, so
 * tokens.test.ts can keep the tab's white text above 4.5 to 1 on the lightest point of its gradient.
 */
import { channels } from "./tokens";

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two colours, 1 to 21, the same whichever is the lighter. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
