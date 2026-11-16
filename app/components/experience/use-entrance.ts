// My experience's entrance clock (round 7 second look, spec 8), the page's side: feeds entrance-state.ts with what happens (the running change's
// reveal starts, ends or is cut short; the picture is shown on a page no change made; a press) and says when to call it over. The reveal's start and length
// come from page-change.ts and `GLASS.ms`; the words' own delays are CSS (entrance.css) from the variables `entranceVars` makes.
import { useCallback, useEffect, useReducer, useRef } from "react";
import { isFinishingKey } from "../../lib/change-finish";
import { getReveal, subscribeReveal } from "../../lib/page-change";
import { WAITING, endDelay, nextEntrance, type EntranceState } from "./entrance-state";

/** A page no change made waits this long for its picture at most before it plays anyway (a picture that never comes must not keep the words away). */
export const PICTURE_WAIT_MS = 2500;
/**
 * The entrance's state for the page, and what the map calls when its trace has drawn its last frame (the entrance is over then: the page's own timer is only
 * a failsafe where a map runs, `endDelay`). `byChange`: the page was made while a change ran (it times itself to that change's reveal). `picture`: when the overview
 * picture was shown (`performance.now()`; null: not yet), for a page that no change made. `reduced`: reduced motion. `map`: the map's engine runs (it says when the trace ends).
 */
export function useEntrance(byChange: boolean, picture: number | null, reduced: boolean, map: boolean): [EntranceState, () => void] {
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
    if (picture !== null) {
      send({ type: "picture", now: performance.now(), at: picture, reduced: wasReduced.current });

      return;
    }

    const timer = window.setTimeout(() => send({ type: "picture", now: performance.now(), reduced: wasReduced.current }), PICTURE_WAIT_MS);

    return () => window.clearTimeout(timer);
  }, [byChange, picture]);

  // a press, a click or a key press finishes it at once (the action is taken: nothing is prevented); the entrance ends by itself after its length
  useEffect(() => {
    if (state.phase === "done") return;

    const press = () => send({ type: "press" });
    const key = (e: KeyboardEvent) => isFinishingKey(e) && press();

    window.addEventListener("pointerdown", press, { capture: true });
    window.addEventListener("click", press, { capture: true }); // a click with no press before it (a script's, an assistive technology's)
    window.addEventListener("keydown", key, { capture: true });

    let timer = 0;

    if (state.phase === "play") timer = window.setTimeout(() => send({ type: "end" }), endDelay(state, performance.now(), map));

    return () => {
      window.removeEventListener("pointerdown", press, { capture: true });
      window.removeEventListener("click", press, { capture: true });
      window.removeEventListener("keydown", key, { capture: true });
      window.clearTimeout(timer);
    };
  }, [state, map]);

  const ended = useCallback(() => send({ type: "end" }), []);

  return [state, ended];
}
