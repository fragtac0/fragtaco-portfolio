// Where the cards of the moments go in explore (spec 9.2): every card shows the date, the title and its one line; only
// where two cards cannot both fit at the current zoom does the one that is not active collapse to the date and the
// title. The same side search as the year pills (`chooseSides` in journey.ts), with boxes the size of a card. Pure maths.
import type { Point } from "./geo";
import { dotBox, hits, sideRect, type Placement, type Rect } from "./journey";

/** map-layers.css `.moment-card`: its width, its padding and border across and down, and its text's line heights (screen px). */
export const CARD = { w: 224, padX: 22, padY: 18, date: 14, titleLine: 17, line: 15, lineGap: 4, titleGap: 2, charW: 7.4, microCharW: 6.4 };

export type CardText = { title: string; line: string };
export type CardPlan = {
  /** The side of its dot the card sits on. */
  side: Placement;
  /** Date and title only; the line shows on hover or focus. */
  compact: boolean;
  /** False when no side clears everything, even collapsed: the card keeps its preferred side and may touch another. */
  fits: boolean;
};

/** A card's size in screen px, worked out from its words (the text wraps in the card's width; the estimate runs a little large). */
export function cardSize(text: CardText, compact: boolean): { w: number; h: number } {
  const inner = CARD.w - CARD.padX;
  const titleLines = Math.max(1, Math.ceil((text.title.length * CARD.charW) / inner));
  const lineLines = Math.max(1, Math.ceil((text.line.length * CARD.microCharW) / inner));
  const head = CARD.padY + CARD.date + CARD.titleGap + titleLines * CARD.titleLine;

  return { w: CARD.w, h: compact ? head : head + CARD.lineGap + lineLines * CARD.line };
}

const SIDES: Placement[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/**
 * Choose each moment's card side and whether it is collapsed, at `scale` (screen px per picture px). Moments are taken
 * the active one first, then in order; each takes the first of: its full card on its preferred side, on the other sides
 * (the diagonals last), then (not for the active one) its collapsed card the same way, that clears every dot and
 * every card already placed. If nothing clears, the preferred side (collapsed unless active) and `fits: false`.
 * `points` are picture pixels, `preferred` the year pills' sides, `active` the moment the visitor is at.
 */
export function planCards(points: readonly Point[], texts: readonly CardText[], preferred: readonly Placement[], scale: number, active: number | null): CardPlan[] {
  const dots = points.map((p) => dotBox(p, scale));
  const order = points.map((_, i) => i).sort((a, b) => (a === active ? -1 : b === active ? 1 : a - b));
  const plans: CardPlan[] = [];
  const placed: Rect[] = [];

  for (const i of order) {
    const sides = [preferred[i], ...SIDES.filter((s) => s !== preferred[i])];
    let plan: CardPlan | null = null;

    for (const compact of i === active ? [false] : [false, true]) {
      const { w, h } = cardSize(texts[i], compact);

      for (const side of sides) {
        const r = sideRect(side, w, h);
        const box = { x0: points[i].x * scale + r.x0, x1: points[i].x * scale + r.x1, y0: points[i].y * scale + r.y0, y1: points[i].y * scale + r.y1 };

        if (dots.some((d, k) => k !== i && hits(box, d)) || placed.some((other) => hits(box, other))) continue;
        plan = { side, compact, fits: true };
        placed.push(box);
        break;
      }
      if (plan) break;
    }
    plans[i] = plan ?? { side: preferred[i], compact: i !== active, fits: false };
  }

  return plans;
}

/** The zoom as a whole number of quarter octaves: the page re-plans the cards when this changes, not on every frame. */
export const zoomStepOf = (scale: number): number => Math.floor(Math.log2(scale) * 4);

/** The scale to plan for in a zoom step: the step's smallest scale, where the moments are closest, so the plan holds across the step. */
export const scaleOfStep = (step: number): number => 2 ** (step / 4);
