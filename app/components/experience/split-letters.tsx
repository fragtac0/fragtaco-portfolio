import { Fragment } from "react";

/**
 * A line of words made of letters, for an entrance that brings them in one by one (entrance.css): each letter is its own span with its
 * place in the line (`--i`, the spaces not counted), the letters of a word kept together so the line breaks only at the spaces. The
 * words are read once: the text is in the page for assistive technology as it is, and the letters are hidden from it.
 */
export default function SplitLetters({ text }: { text: string }) {
  let n = 0;

  return (
    <>
      <span className="sr-only">{text}</span>
      <span className="map-letters" aria-hidden="true">
        {text.split(" ").map((word, w) => (
          <Fragment key={w}>
            {w > 0 ? " " : null}
            <span className="map-word">
              {Array.from(word, (letter, i) => (
                <span key={i} className="map-letter" style={{ "--i": n++ } as React.CSSProperties}>
                  {letter}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </>
  );
}
