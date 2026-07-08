/**
 * Parse WebVTT transcript content into plain text with speaker labels.
 *
 * Teams transcripts come as VTT with timing cues and speaker tags:
 *   WEBVTT
 *
 *   00:00:01.000 --> 00:00:05.000
 *   <v Dr. Rivera>Good morning, let's start with your caseload update.</v>
 *
 * This strips the timing lines and VTT markup, keeping speaker labels
 * for context in the AI note pipeline.
 */

export function parseVttToText(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const textLines: string[] = [];
  let lastSpeaker = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "WEBVTT" || trimmed === "NOTE" || trimmed === "") continue;
    // Skip timing cues (e.g. "00:00:01.000 --> 00:00:05.000")
    if (/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(trimmed)) continue;
    // Skip cue identifiers (bare numbers or identifiers before timing lines)
    if (/^\d+$/.test(trimmed)) continue;

    // Extract speaker from <v Speaker Name>text</v> tags
    const voiceMatch = trimmed.match(/^<v\s+([^>]+)>(.*)<\/v>$/);
    if (voiceMatch) {
      const speaker = voiceMatch[1].trim();
      const text = voiceMatch[2].replace(/<[^>]+>/g, "").trim();
      if (speaker !== lastSpeaker) {
        textLines.push(`${speaker}: ${text}`);
        lastSpeaker = speaker;
      } else {
        textLines.push(text);
      }
      continue;
    }

    // Plain text line (no voice tag) — strip any remaining VTT tags
    const cleaned = trimmed.replace(/<[^>]+>/g, "").trim();
    if (cleaned) {
      textLines.push(cleaned);
    }
  }

  return textLines.join("\n");
}
