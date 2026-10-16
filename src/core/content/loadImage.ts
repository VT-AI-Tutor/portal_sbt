export function decodeImage(
  src: string,
  crossOrigin?: HTMLImageElement["crossOrigin"],
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to decode image"));
    img.src = src;
  });
}

export async function loadImageViaBlob(url: string): Promise<HTMLImageElement> {
  // Blob URLs are blocked by strict CSP in the learner app. Load the remote
  // image directly so browsers can use the permitted https: image source.
  return decodeImage(url, "use-credentials");
}
