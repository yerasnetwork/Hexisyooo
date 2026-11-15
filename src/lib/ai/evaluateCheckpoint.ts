import OpenAI from "openai";

function getClient(): OpenAI | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_BASE_URL || "https://integrate.api.nvidia.com/v1";
  return new OpenAI({ apiKey, baseURL });
}

/**
 * Lenient check that the reader engaged with the section, not a grading of
 * writing quality. Never blocks the user on a provider hiccup — any error or
 * missing config fails open (passed: true), since the goal is verification,
 * not gatekeeping.
 */
export async function evaluateCheckpointAnswer(
  checkpoint: string,
  sectionContent: string,
  answer: string
): Promise<{ passed: boolean; feedback?: string }> {
  const client = getClient();
  if (!client) return { passed: true };

  const model = process.env.AI_MODEL || "meta/llama-3.1-8b-instruct";
  const prompt = `You are checking whether a reader actually engaged with a section of text — not grading writing quality.

Section text (may be in any language):
"""
${sectionContent.slice(0, 3000)}
"""

Checkpoint question: "${checkpoint}"

Reader's answer (may be in a different language than the section): "${answer}"

Be lenient: pass if the answer is reasonably related to the section's content or the question, even if brief, imperfect, or in another language. Only fail if the answer is clearly unrelated, nonsensical, or has no real content.

Respond with STRICT JSON only: {"passed": true, "feedback": "only include if failed, one short sentence"}`;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
    });
    const raw = completion.choices[0]?.message?.content || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (typeof parsed.passed === "boolean") {
      return { passed: parsed.passed, feedback: parsed.feedback };
    }
    return { passed: true };
  } catch (err) {
    console.error("Checkpoint AI evaluation failed, accepting answer by default:", err);
    return { passed: true };
  }
}
