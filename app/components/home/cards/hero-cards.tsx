import { useRef, useState, type MutableRefObject, type RefObject } from "react";
import type { SiteCredits, SiteHomeContent } from "../../../types";
import type { HeroHandle } from "../hero/hero";
import { modeOf } from "./card-shell";
import CreditsCard from "./credits-card";
import type { NavContext, NavInput, NavState } from "./hero-nav";
import IntroCard from "./intro-card";
import "./cards.css";
import { NO_HOT, useCardGestures } from "./use-card-gestures";

type HeroCardsProps = {
  about: SiteHomeContent["about"];
  credits: SiteCredits;
  nav: NavState;
  dispatch: (input: NavInput) => void;
  /** The hero, for its root element (wheel, touch and visibility listeners live on it). */
  hero: RefObject<HeroHandle>;
  /** The reducer's context. The gestures hook keeps `heroVisible` current in it. */
  navCtx: MutableRefObject<NavContext>;
};

/**
 * The two floating cards and the tint behind them. Rendered as children of the hero `<section>`
 * so the hero clips them and they scroll away with it. All motion is imperative (see
 * useCardGestures); React only renders classes, `inert` and `aria-hidden` from `nav`.
 */
export default function HeroCards({ about, credits, nav, dispatch, hero, navCtx }: HeroCardsProps) {
  const leftRef = useRef<HTMLElement>(null);
  const rightRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState(NO_HOT);

  useCardGestures({ hero, leftRef, rightRef, scrimRef, nav, hot, setHot, dispatch, ctx: navCtx });

  return (
    <>
      <div ref={scrimRef} className="scrim" aria-hidden="true" />
      <CreditsCard
        credits={credits}
        cardRef={leftRef}
        mode={modeOf(nav, "left")}
        hot={hot.left}
      />
      <IntroCard
        about={about}
        cardRef={rightRef}
        mode={modeOf(nav, "right")}
        hot={hot.right}
      />
    </>
  );
}
