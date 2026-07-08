import { describe, it, expect } from "vitest";
import { parseVttToText } from "@/lib/calendar/vtt-parser";

describe("parseVttToText", () => {
  it("parses a basic VTT with speaker tags", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:05.000",
      "<v Dr. Rivera>Good morning, let's start with your caseload update.</v>",
      "",
      "00:00:06.000 --> 00:00:10.000",
      "<v Jordan Reyes>Sure, I have three active cases this week.</v>",
    ].join("\n");

    const result = parseVttToText(vtt);
    expect(result).toBe(
      "Dr. Rivera: Good morning, let's start with your caseload update.\n" +
        "Jordan Reyes: Sure, I have three active cases this week."
    );
  });

  it("collapses consecutive lines from the same speaker", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:03.000",
      "<v Dr. Rivera>First sentence.</v>",
      "",
      "00:00:03.500 --> 00:00:06.000",
      "<v Dr. Rivera>Second sentence, same speaker.</v>",
      "",
      "00:00:07.000 --> 00:00:10.000",
      "<v Jordan Reyes>Now a different speaker.</v>",
    ].join("\n");

    const result = parseVttToText(vtt);
    expect(result).toBe(
      "Dr. Rivera: First sentence.\n" +
        "Second sentence, same speaker.\n" +
        "Jordan Reyes: Now a different speaker."
    );
  });

  it("handles plain text without voice tags", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:01.000 --> 00:00:05.000",
      "Hello, this is a test.",
      "",
      "2",
      "00:00:06.000 --> 00:00:10.000",
      "Another line of text.",
    ].join("\n");

    const result = parseVttToText(vtt);
    expect(result).toBe("Hello, this is a test.\nAnother line of text.");
  });

  it("strips inline HTML/VTT tags", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:05.000",
      "This has <b>bold</b> and <i>italic</i> tags.",
    ].join("\n");

    const result = parseVttToText(vtt);
    expect(result).toBe("This has bold and italic tags.");
  });

  it("returns empty string for empty VTT", () => {
    expect(parseVttToText("WEBVTT\n\n")).toBe("");
  });

  it("handles Windows-style line endings", () => {
    const vtt =
      "WEBVTT\r\n\r\n00:00:01.000 --> 00:00:05.000\r\n<v Speaker>Hello.</v>\r\n";
    const result = parseVttToText(vtt);
    expect(result).toBe("Speaker: Hello.");
  });
});
