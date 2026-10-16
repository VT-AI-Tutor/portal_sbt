/**
 * Build a URL for embedding a PDF in an iframe/object.
 * Uses Adobe/Open PDF fragment parameters supported by Chromium's built-in viewer.
 */
export function buildPdfEmbedSrc(
  url: string,
  options?: { fitWidth?: boolean; toolbar?: boolean; navpanes?: boolean },
): string {
  const fitWidth = options?.fitWidth ?? true;
  const toolbar = options?.toolbar ?? true;
  const navpanes = options?.navpanes ?? false;

  const base = url.split("#")[0] ?? url;
  const params = [`toolbar=${toolbar ? 1 : 0}`, `navpanes=${navpanes ? 1 : 0}`];
  if (fitWidth) {
    params.push("view=FitH", "zoom=page-width");
  }
  return `${base}#${params.join("&")}`;
}
