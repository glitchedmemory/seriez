/** Strips HTML tags from a string. Used to clean AniList API descriptions. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
