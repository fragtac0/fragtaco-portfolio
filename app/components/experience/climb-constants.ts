// The numbers of the map's loop (climb-engine.ts), apart so the loop's file stays a loop. Re-exported by climb-engine.ts.

/** The night map is drawn only above this much night (below it its opacity is 0). */
export const NIGHT_ON = 0.04;
/** The picture is moved only while it can be seen. */
export const PICTURE_SEEN = 0.003;
/** Where the camera starts on the trail when it goes into My climb, before it settles for the chosen milestone. */
export const ENTRY_U = 0.72;
/** How long the card waits: for a milestone already in view, for one the camera has to travel to, and for the change into My climb (milliseconds). */
export const WAIT_STAY = 250;
export const WAIT_MOVE = 1300;
export const WAIT_ENTRY = 3150;
/** The spring is at rest when it is this near its goal and this slow. */
export const REST = 0.0004;
/** A bead whose head is past this share of the stage's width shows its label on its left (the side with more room), so the label is not cut off at the edge. */
export const FLIP_AT = 0.5;
/** The radar is redrawn at about 30 frames a second (its ring moves under half a pixel a frame): this many milliseconds apart at least (Ruling R102). */
export const RADAR_GAP = 30;
/** A bead's touch target, in pixels (the overview keeps the whole of it on the screen). */
export const BEAD_TARGET = 44;
