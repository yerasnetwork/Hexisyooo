/** Formats seconds as "M:SS" (e.g. 45 -> "0:45", 180 -> "3:00"). */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Crude but effective sentence splitter for plain extracted text. */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  return (matches ?? [normalized]).map((s) => s.trim()).filter(Boolean);
}

/**
 * Groups text into reading-sized paragraphs. Respects existing blank-line
 * breaks when present (e.g. AI-generated content); otherwise groups
 * sentences so raw extracted text still renders as real paragraphs instead
 * of one block.
 */
export function paragraphize(text: string, targetChars = 500): string[] {
  const existing = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (existing.length > 1) return existing;

  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const paragraphs: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const sentence of sentences) {
    current.push(sentence);
    length += sentence.length;
    if (length >= targetChars) {
      paragraphs.push(current.join(" "));
      current = [];
      length = 0;
    }
  }
  if (current.length) paragraphs.push(current.join(" "));
  return paragraphs;
}

/** Derives a short, content-specific title from a block of text — no AI call. */
export function deriveTitleFromText(text: string, maxLen = 64): string {
  const trimmed = text.trim();
  if (!trimmed) return "Untitled section";

  const firstLine = trimmed.split("\n")[0].trim();
  const wordTokens = firstLine.split(/\s+/).filter((w) => /[a-zA-Z]{2,}/.test(w));
  const looksLikeHeading =
    firstLine.length > 0 &&
    firstLine.length <= maxLen &&
    !/[.!?]$/.test(firstLine) &&
    !/^[[(]?\d/.test(firstLine) && // not a page number, figure/citation marker
    wordTokens.length >= 3 &&
    firstLine.split(/\s+/).length <= 10;
  if (looksLikeHeading) return firstLine;

  // Skip tiny junk fragments (stray list markers, page artifacts) rather
  // than letting them become the title.
  const sentences = splitSentences(trimmed);
  const firstSubstantial =
    sentences.find((s) => s.replace(/\s+/g, "").length >= 12) ?? sentences[0] ?? trimmed;
  const base = firstSubstantial.replace(/\s+/g, " ").trim();
  const cleaned = base.replace(/[.!?]+$/, "");
  if (cleaned.length <= maxLen) return cleaned;

  const truncated = cleaned.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 20 ? lastSpace : maxLen)}…`;
}

/** Appends a distinguishing suffix to any titles that collide, preserving order. */
export function ensureUniqueTitles(titles: string[]): string[] {
  const seen = new Map<string, number>();
  return titles.map((title) => {
    const count = seen.get(title) ?? 0;
    seen.set(title, count + 1);
    return count === 0 ? title : `${title} (part ${count + 1})`;
  });
}
