import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteBook } from "../../../types";
import { inkOn } from "../blocks/mini-previews";
import { inertIf } from "../cards/card-shell";
import { useLayerControl } from "../layer/layer-context";

/** Covers are fetched at runtime and never stored. A missing one is a 404 (`default=false`). */
export const coverUrl = (isbn: string) =>
  `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;

type ReadingFallbackProps = {
  books: SiteBook[];
};

/**
 * The reading pane without WebGL2: the books as a simple grid of covers (a cover image, or a CSS
 * cover in the spine colour with the title when none loads), each a button. Activating one shows
 * the same note as the shelf: title, "author, pages", the placeholder note and "Put it back".
 * Esc closes the note before the layer, through the same hooks the shelf registers.
 */
export default function ReadingFallback({ books }: ReadingFallbackProps) {
  const { registerSceneHooks } = useLayerControl();
  const [openId, setOpenId] = useState<string | null>(null);
  /** Covers that failed to load: their button shows the CSS cover instead. */
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const openRef = useRef<string | null>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  /** The book to give focus back to when the note closes. */
  const returnTo = useRef<string | null>(null);

  const close = useCallback(() => {
    if (openRef.current === null) return;
    returnTo.current = openRef.current;
    openRef.current = null;
    setOpenId(null);
  }, []);

  useEffect(
    () =>
      registerSceneHooks({
        isBookOpen: () => openRef.current !== null,
        closeBook: close,
      }),
    [registerSceneHooks, close],
  );

  // focus: into the note when it opens, back to the book's button when it closes
  useEffect(() => {
    if (openId !== null) {
      backRef.current?.focus({ preventScroll: true });
    } else if (returnTo.current !== null) {
      const id = returnTo.current;
      returnTo.current = null;
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-book="${id}"]`)
        ?.focus({ preventScroll: true });
    }
  }, [openId]);

  const open = books.find((b) => b.id === openId) ?? null;

  return (
    <div className="fb-scene">
      <div className="fb-scroll" {...inertIf(!!open)}>
        <ul ref={gridRef} className="fb-grid fb-books" aria-label="Books on the shelf">
          {books.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className="fb-item"
                data-book={b.id}
                onClick={() => {
                  openRef.current = b.id;
                  setOpenId(b.id);
                }}
              >
                {broken.has(b.id) ? (
                  <span
                    className="fb-cover fb-cover-css"
                    style={{
                      backgroundColor: b.spine,
                      color: inkOn(b.spine),
                      aspectRatio: b.aspect,
                    }}
                    aria-hidden="true"
                  >
                    {b.title}
                  </span>
                ) : (
                  <img
                    className="fb-cover"
                    src={coverUrl(b.isbn)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ aspectRatio: b.aspect }}
                    onError={() => setBroken((prev) => new Set(prev).add(b.id))}
                  />
                )}
                <span className="fb-title">{b.title}</span>
                <span className="fb-sub">{b.author}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {open ? (
        <div className="fb-note-wrap">
          <div className="fb-backdrop" role="presentation" onClick={close} />
          <div className="fb-note" role="group" aria-label={open.title}>
            <h3>{open.title}</h3>
            <p className="by">{`${open.author}, ${open.pages} pages`}</p>
            <p className="note placeholder">{open.note}</p>
            <button ref={backRef} type="button" onClick={close}>
              Put it back
            </button>
          </div>
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {open ? `${open.title}, ${open.author}, ${open.pages} pages. ${open.note}` : ""}
      </p>
    </div>
  );
}
