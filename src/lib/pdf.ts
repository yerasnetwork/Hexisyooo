import { extractText, getDocumentProxy } from "unpdf";
import { deriveTitleFromText, ensureUniqueTitles, splitSentences } from "./text";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export type BookSection = { title: string; content: string };

const WORDS_PER_MINUTE = 180; // average silent reading pace, used to size sections
const MIN_SECTIONS = 1;
const MAX_SECTIONS = 60;

/**
 * Splits extracted text into natural, sentence-complete reading sections
 * sized from the material's own length — not a fixed count derived from the
 * plan's duration/sessions inputs. Each section's title is derived from its
 * own text (a detected heading-like first line, or its opening sentence).
 * Section size follows reading pace: a shorter session means a smaller chunk.
 */
export function buildBookSections(text: string, secondsPerSession: number): BookSection[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const totalWords = text.split(/\s+/).filter(Boolean).length;
  const paceWordsPerSection = Math.max(40, Math.round((secondsPerSession / 60) * WORDS_PER_MINUTE));
  const estimatedSections = Math.max(
    MIN_SECTIONS,
    Math.min(MAX_SECTIONS, Math.round(totalWords / paceWordsPerSection))
  );
  const targetWordsPerSection = Math.max(40, Math.round(totalWords / estimatedSections));

  const blocks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;
  for (const sentence of sentences) {
    current.push(sentence);
    wordCount += sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount >= targetWordsPerSection && blocks.length < estimatedSections - 1) {
      blocks.push(current.join(" "));
      current = [];
      wordCount = 0;
    }
  }
  if (current.length) blocks.push(current.join(" "));

  const titles = ensureUniqueTitles(blocks.map((b) => deriveTitleFromText(b)));
  return blocks.map((content, i) => ({ title: titles[i], content }));
}
