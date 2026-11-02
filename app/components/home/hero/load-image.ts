/** Loads and decodes an image; resolves null on a failed load, never rejects. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // decode() moves the texture-sized decode off the moment the reveal starts
      img.decode().then(
        () => resolve(img),
        () => resolve(img),
      );
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
