import CloseButton from "../close-button";

/**
 * The way back from a wall to the rings (top right): the shelves' close button, the same component and place, saying
 * "Back" and going to `/work` through the page change (Esc does the same). A link, so it is a tab stop and Enter follows it.
 */
export default function BackButton() {
  return <CloseButton to="/work" label="Back" ariaLabel="Back to my portfolio" />;
}
