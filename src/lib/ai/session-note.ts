import { createHash } from "node:crypto";

export type SessionNoteData = {
  topics: string[];
  competencies: string[];
  supervisorFeedback: string;
  nextSteps: string[];
};

/**
 * AI note metadata stamped on every generation.
 *
 * `source` distinguishes manual paste vs Teams transcript ingestion. The
 * Teams integration path (future) will pass `source: "teams"` and the
 * `teamsMeetingId` from MS Graph so we can trace which Teams meeting
 * produced the note. The transcript itself is never persisted — only the
 * hash + word count for audit. */
export type SessionNoteMetadata = {
  generatedAt: string;
  generatedByUserId: string;
  model: string;
  transcriptHash: string;
  transcriptWordCount: number;
  /** "manual" = supervisor pasted the transcript. "teams" = ingested
   *  from a Teams meeting transcript via MS Graph. Defaults to "manual"
   *  for backward compat with notes generated before this field existed. */
  source?: "manual" | "teams";
  /** MS Graph onlineMeeting id for Teams-sourced notes. */
  teamsMeetingId?: string;
};

const SYSTEM_PROMPT = `You are a clinical supervision documentation assistant. Given a transcript of a supervision session between a licensed mental-health supervisor and a pre-licensed supervisee, extract a structured session note.

Return ONLY a JSON object with these exact keys:
- "topics": array of strings — clinical topics discussed (e.g., "termination ethics", "transference dynamics", "trauma-informed care frameworks")
- "competencies": array of strings — clinical competencies the supervisee demonstrated or worked on (e.g., "case conceptualization", "diagnostic reasoning", "self-of-the-therapist awareness")
- "supervisorFeedback": single string — the supervisor's substantive feedback or guidance, summarized in 2-4 sentences
- "nextSteps": array of strings — action items, readings, or development goals identified for next session

Constraints:
- Do NOT include any client-identifying information. If client names, locations, or identifiers appear in the transcript, omit them entirely.
- Treat the transcript as confidential. Do not echo verbatim quotes.
- Write in a clinical/professional register suitable for a supervision evidence package.
- If the transcript is too short or incoherent to extract a meaningful note, return empty arrays and a one-sentence supervisorFeedback explaining the limitation.`;

const MAX_TRANSCRIPT_CHARS = 50_000;

/** Generate a structured session note from a transcript. Throws on OpenAI errors;
 *  caller must wrap in try/catch. */
export async function generateSessionNote(opts: {
  transcript: string;
  generatedByUserId: string;
  source?: "manual" | "teams";
  teamsMeetingId?: string;
}): Promise<{ note: SessionNoteData; metadata: SessionNoteMetadata }> {
  const trimmed = opts.transcript.trim().slice(0, MAX_TRANSCRIPT_CHARS);
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const hash = createHash("sha256").update(trimmed).digest("hex");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-2024-08-06";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to environment variables to enable AI session notes."
    );
  }

  // Dynamic import to keep the openai client out of pages that don't need it
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `TRANSCRIPT:\n\n${trimmed}` },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON content.");
  }

  // Validate shape (light Zod-free check; trust the response_format json_object guard)
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).topics) ||
    !Array.isArray((parsed as Record<string, unknown>).competencies) ||
    typeof (parsed as Record<string, unknown>).supervisorFeedback !== "string" ||
    !Array.isArray((parsed as Record<string, unknown>).nextSteps)
  ) {
    throw new Error("OpenAI response missing required fields.");
  }

  const p = parsed as Record<string, unknown>;
  const note: SessionNoteData = {
    topics: (p.topics as unknown[]).map(String),
    competencies: (p.competencies as unknown[]).map(String),
    supervisorFeedback: String(p.supervisorFeedback),
    nextSteps: (p.nextSteps as unknown[]).map(String),
  };

  const metadata: SessionNoteMetadata = {
    generatedAt: new Date().toISOString(),
    generatedByUserId: opts.generatedByUserId,
    model,
    transcriptHash: hash,
    transcriptWordCount: wordCount,
    source: opts.source ?? "manual",
    ...(opts.teamsMeetingId ? { teamsMeetingId: opts.teamsMeetingId } : {}),
  };

  return { note, metadata };
}
