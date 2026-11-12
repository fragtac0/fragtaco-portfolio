import { useId, useState } from "react";

type Props = {
  title: string;
  text: string;
  labels: { more: string; less: string };
};

/**
 * The heading block (spec 9.4), top left: the title and the paragraph, in the page's heading. On phones (R46) the
 * paragraph is clamped to two lines by CSS and a button opens the rest in place; the whole paragraph is in the
 * document either way. The button is hidden wider than a phone, where the paragraph shows whole.
 */
export default function HeadingBlock({ title, text, labels }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <header className="map-heading" data-open={open ? "" : undefined}>
      <h1 className="map-title">{title}</h1>
      <p className="map-text" id={id}>
        {text}
      </p>
      <button type="button" className="map-more" data-map-ui="" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {open ? labels.less : labels.more}
      </button>
    </header>
  );
}
