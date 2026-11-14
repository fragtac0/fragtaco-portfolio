import { forwardRef } from "react";
import type { ExperienceMoment } from "../../types";
import type { CardView } from "./card-controller";
import { StruckTitle } from "./experience-plain";
import "./cards.css";

type Props = {
  moments: ExperienceMoment[];
  /** The word between "3" and "9" in "3 of 9". */
  of: string;
};

/**
 * The glass card of a milestone (spec 9.5): the date and "3 of 9", the title (its struck part struck), a thin rule and the
 * line. The words of every milestone are in the page (only the chosen one is shown, by `cardView`), so changing the words
 * is one attribute and needs no render. The card is for the eye: the same words are in the list for a screen reader.
 */
const MomentCard = forwardRef<HTMLDivElement, Props>(function MomentCard({ moments, of }, ref) {
  return (
    <div ref={ref} className="map-card" aria-hidden="true">
      {moments.map((moment, i) => (
        <div key={moment.id} className="map-card-body">
          <div className="map-card-when">
            <span>{moment.label}</span>
            <span>{`${i + 1} ${of} ${moments.length}`}</span>
          </div>
          <h3 className="map-card-title">
            <StruckTitle moment={moment} />
          </h3>
          <div className="map-card-rule" />
          <p className="map-card-line">{moment.line}</p>
        </div>
      ))}
    </div>
  );
});

export default MomentCard;

/** The card's element as the card's controller sees it, with the beads whose strength it sets. */
export function cardView(card: HTMLElement, pins: () => readonly (HTMLElement | null)[]): CardView {
  const bodies = [...card.querySelectorAll<HTMLElement>(".map-card-body")];
  const size = () => ({ w: card.offsetWidth, h: card.offsetHeight });

  return {
    setWords(index) {
      bodies.forEach((body, i) => body.toggleAttribute("data-on", i === index));
      card.classList.remove("draw");

      return size();
    },
    size,
    show(on) {
      if (on) {
        card.classList.remove("draw");
        void card.offsetWidth; // the words' fade starts again
        card.classList.add("show", "draw");
      } else {
        card.classList.remove("show");
      }
    },
    place(x, y) {
      card.style.setProperty("--cx", `${x}px`);
      card.style.setProperty("--cy", `${y}px`);
    },
    cover(indices) {
      pins().forEach((pin, i) => {
        if (!pin) return;

        const under = indices.includes(i);

        // a bead under the card is stepped back and cannot be pressed through the glass (it can still be reached with the keyboard)
        pin.style.opacity = under ? "0.16" : "";
        pin.style.pointerEvents = under ? "none" : "";
      });
    },
  };
}
