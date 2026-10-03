/**
 * Converts markdown, HTML, and rich content into clean, human-readable plain text.
 * Strips out code syntax, markdown links, images, headings, HTML tags, and entities
 * so that excerpts and card previews display purely as plain text.
 */
export function getPlainText(content?: string | null): string {
  if (!content) return '';

  let text = String(content);

  // 1. Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Remove script and style tags and their contents
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 3. Remove markdown images: ![alt](url)
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');

  // 4. Convert markdown links: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 5. Remove markdown reference links: [text][ref] -> text
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

  // 6. Remove fenced code blocks ``` ... ```
  text = text.replace(/```[\s\S]*?```/g, '');

  // 7. Remove inline code `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');

  // 8. Remove markdown headers: # Title -> Title
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 9. Remove blockquotes: > text -> text
  text = text.replace(/^>\s+/gm, '');

  // 10. Remove bold / italic: **bold**, __bold__, *italic*, _italic_, ~~strike~~
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');

  // 11. Remove markdown list bullets/numbers at beginning of line
  text = text.replace(/^[\s*+-]+\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');

  // 12. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // 13. Decode common HTML entities
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&hellip;': '...',
    '&mdash;': '—',
    '&ndash;': '–',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™'
  };

  text = text.replace(/&(?:nbsp|amp|quot|apos|#39|lt|gt|hellip|mdash|ndash|copy|reg|trade);/gi, (match) => entities[match.toLowerCase()] || ' ');
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // 14. Collapse consecutive spaces and line breaks into single space
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Strips markdown and HTML formatting, returning a clean plain-text excerpt
 * truncated to a maximum character count (default 160) without breaking words.
 */
export function getExcerpt(content?: string | null, maxChars = 160): string {
  const plain = getPlainText(content);
  if (!plain) return '';
  if (plain.length <= maxChars) return plain;
  const truncated = plain.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated.trim() + '...';
}

