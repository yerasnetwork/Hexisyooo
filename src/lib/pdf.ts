import pdfParse from "pdf-parse";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}

/** Splits text into exactly `count` roughly-equal chunks by word count (no chapter awareness). */
export function splitIntoChunks(text: string, count: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunkSize = Math.max(1, Math.ceil(words.length / count));
  return Array.from({ length: count }, (_, i) =>
    words.slice(i * chunkSize, (i + 1) * chunkSize).join(" ")
  );
}
