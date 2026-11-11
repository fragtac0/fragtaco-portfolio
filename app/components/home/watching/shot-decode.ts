/**
 * Waits for a picture to be decoded, for at most `ms`, so a flight that starts with it never
 * shows a blank shot. Resolves true when it decoded in time, false when it took too long or could
 * not be decoded (the caller flies anyway: a late picture just fills in).
 */
export function whenDecoded(
  img: Pick<HTMLImageElement, "decode">,
  ms: number,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    img.decode().then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}
