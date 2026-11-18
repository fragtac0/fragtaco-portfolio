import type { IconType } from "react-icons";
import { PiFilmSlateFill, PiGearSixFill, PiGraduationCapFill, PiMegaphoneFill, PiMicrophoneFill, PiPaperPlaneTiltFill, PiPersonSimpleHikeFill, PiScissorsFill, PiVideoCameraFill } from "react-icons/pi";
import type { ExperienceIcon, ExperienceMoment } from "../../types";
import "./cards.css";

/** The nine beads' icons (Phosphor, fill weight), by the names of the content. */
export const BEAD_ICONS: Record<ExperienceIcon, IconType> = {
  gear: PiGearSixFill,
  scissors: PiScissorsFill,
  "graduation-cap": PiGraduationCapFill,
  megaphone: PiMegaphoneFill,
  "video-camera": PiVideoCameraFill,
  "film-slate": PiFilmSlateFill,
  microphone: PiMicrophoneFill,
  "paper-plane": PiPaperPlaneTiltFill,
  hiker: PiPersonSimpleHikeFill,
};

type Props = {
  moments: ExperienceMoment[];
  /** The chosen milestone in My climb (it turns orange), or null in the overview. */
  selected: number | null;
  /** Whether a bead can be pressed (the heights are loaded). */
  ready: boolean;
  onChoose: (index: number) => void;
  /** The box holding the beads, and each bead: the engine moves them each frame. */
  boxRef: (el: HTMLDivElement | null) => void;
  pinRef: (index: number, el: HTMLButtonElement | null) => void;
};

/**
 * The milestones as glass beads (spec 9.3), each a button of 44 px with a Phosphor icon (hidden in the overview), a label
 * on hover and on focus that is also its name for a screen reader. Pressing one in the overview goes into My climb at
 * that milestone; in My climb it moves the camera there. The last, "now", is orange. The engine places each with a
 * transform; before it has, the box is invisible. A touch or a click is taken by the button's hit span, which the engine cuts to the
 * bead's own share of the 44 px when beads overlap (bead-hit.ts, R108), so the visible centre of a bead always opens that bead; the
 * keyboard and a screen reader use the button.
 */
export default function MilestonePins({ moments, selected, ready, onChoose, boxRef, pinRef }: Props) {
  return (
    <div ref={boxRef} className="map-pins">
      {moments.map((moment, i) => {
        const Icon = BEAD_ICONS[moment.icon];

        return (
          <button
            key={moment.id}
            ref={(el) => pinRef(i, el)}
            type="button"
            className="map-pin"
            disabled={!ready}
            data-now={i === moments.length - 1 ? "" : undefined}
            data-current={selected === i ? "" : undefined}
            aria-current={selected === i ? "step" : undefined}
            onClick={() => ready && onChoose(i)}
          >
            <span className="map-hit" aria-hidden="true" />
            <span className="map-bead" aria-hidden="true">
              <Icon />
            </span>
            <span className="map-pin-tip">{`${moment.label}: ${moment.title}`}</span>
          </button>
        );
      })}
    </div>
  );
}
