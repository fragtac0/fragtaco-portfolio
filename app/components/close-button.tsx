import { forwardRef, type Ref } from "react";
import PageLink from "./page-link";
import "./close-button.css";

interface CloseButtonProps {
  /** The word on the button: "Close" on a shelf, "Back" on a wall. */
  label: string;
  /** The key that does the same, shown beside the word on a device that has a keyboard. */
  hint?: string;
  /** With a page address the button is a link to it through the page change; without one it is a button that calls `onClick`. */
  to?: string;
  onClick?: () => void;
  /** The accessible name when the visible word is not enough ("Back to my portfolio"); it must start with the visible word. */
  ariaLabel?: string;
}

/**
 * The one way out of a full page layer, top right: the shelves' "Close" and the walls' "Back". The same
 * component, the same look and the same place (the header's right end), so a later change to the pill is one change.
 * It is a button (the shelves close in place) or, given `to`, a link (the walls go to the rings through the page
 * change), and in both a tab stop with a visible focus ring.
 */
const CloseButton = forwardRef<HTMLElement, CloseButtonProps>(function CloseButton(
  { label, hint = "Esc", to, onClick, ariaLabel },
  ref,
) {
  const content = (
    <>
      {label} <kbd>{hint}</kbd>
    </>
  );
  if (to) {
    return (
      <PageLink ref={ref as Ref<HTMLAnchorElement>} to={to} className="xp-close" aria-label={ariaLabel}>
        {content}
      </PageLink>
    );
  }
  return (
    <button ref={ref as Ref<HTMLButtonElement>} type="button" className="xp-close" onClick={onClick} aria-label={ariaLabel}>
      {content}
    </button>
  );
});

export default CloseButton;
