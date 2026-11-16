// My experience's entrance clock (round 7 second look, spec 8), the page's side: feeds entrance-state.ts with what happens (the running change's
// reveal starts, ends or is cut short; the picture is shown on a page no change made; a press) and says when to call it over. The reveal's start and length
// come from page-change.ts and `GLASS.ms`; the words' own delays are CSS (entrance.css) from the variables `entranceVars` makes.
import { useEffect, useReducer, useRef } from "react";
import { isFinishingKey } from "../../lib/change-finish";
import { getReveal, subscribeReveal } from "../../lib/page-change";
import { entranceEnd } from "./entrance";
import { WAITING, nextEntrance, type EntranceState } from "./entrance-state";

/** A page no change made waits this long for its picture at most before it plays anyway (a picture that never comes must not keep the words away). */
export const PICTURE_WAIT_MS = 2500;
/** The entrance is called over this long after its length, so the last drawn frames are not cut. */
const END_SLACK_MS = 150;

/**
 * The entrance's state for the page. `byChange`: the page was made while a change ran (it times itself to that change's reveal). `picture`: the overview
 * picture is shown (loaded, or failed), for a page that no change made. `reduced`: reduced motion.
 */
export function useEntrance(byChange: boolean, picture: boolean, reduced: boolean): EntranceState {
  const [state, send] = useReducer(nextEntrance, WAITING);
  const wasReduced = useRef(reduced);

  useEffect(() => {
    wasReduced.current = reduced;
  });

  // a page made by a change: the reveal's start, and a change that is cut short
  useEffect(() => {
    if (!byChange) return;

    const read = () => send({ type: "reveal", reveal: getReveal(), now: performance.now() });

    read();

    return subscribeReveal(read);
  }, [byChange]);

  // a first load or a deep link: counted from the moment the picture is shown
  useEffect(() => {
    if (byChange) return;
    if (picture) {
      send({ type: "picture", now: performance.now(), reduced: wasReduced.current });

      return;
    }

    const timer = window.setTimeout(() => send({ type: "picture", now: performance.now(), reduced: wasReduced.current }), PICTURE_WAIT_MS);

    return () => window.clearTimeout(timer);
  }, [byChange, picture]);

  // a press or a key press finishes it at once (the action is taken: nothing is prevented); the entrance ends by itself after its length
  useEffect(() => {
    if (state.phase === "done") return;

    const press = () => send({ type: "press" });
    const key = (e: KeyboardEvent) => isFinishingKey(e) && press();

    window.addEventListener("pointerdown", press, { capture: true });
    window.addEventListener("keydown", key, { capture: true });

    let timer = 0;

    if (state.phase === "play") timer = window.setTimeout(() => send({ type: "end" }), Math.max(0, state.t0 + entranceEnd(state.ms) + END_SLACK_MS - performance.now()));

    return () => {
      window.removeEventListener("pointerdown", press, { capture: true });
      window.removeEventListener("keydown", key, { capture: true });
      window.clearTimeout(timer);
    };
  }, [state]);

  return state;
}
