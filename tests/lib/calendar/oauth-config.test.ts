import { describe, it, expect } from "vitest";
import {
  hasTranscriptScope,
  getTranscriptScope,
  PROVIDERS,
} from "@/lib/calendar/oauth-config";

describe("hasTranscriptScope", () => {
  it("returns true for Microsoft when OnlineMeetingTranscript.Read.All is granted", () => {
    expect(
      hasTranscriptScope("microsoft", [
        "openid",
        "Calendars.ReadWrite",
        "OnlineMeetingTranscript.Read.All",
      ])
    ).toBe(true);
  });

  it("returns false for Microsoft when transcript scope is missing", () => {
    expect(
      hasTranscriptScope("microsoft", [
        "openid",
        "Calendars.ReadWrite",
        "OnlineMeetings.ReadWrite",
      ])
    ).toBe(false);
  });

  it("is case-insensitive for Microsoft scope matching", () => {
    expect(
      hasTranscriptScope("microsoft", [
        "onlinemeetingtranscript.read.all",
      ])
    ).toBe(true);
  });

  it("returns true for Google when drive.readonly is granted", () => {
    expect(
      hasTranscriptScope("google", [
        "openid",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/drive.readonly",
      ])
    ).toBe(true);
  });

  it("returns false for Google when Drive scope is missing", () => {
    expect(
      hasTranscriptScope("google", [
        "openid",
        "https://www.googleapis.com/auth/calendar.events",
      ])
    ).toBe(false);
  });

  it("returns false for empty scopes array", () => {
    expect(hasTranscriptScope("microsoft", [])).toBe(false);
    expect(hasTranscriptScope("google", [])).toBe(false);
  });
});

describe("getTranscriptScope", () => {
  it("returns the correct scope for Microsoft", () => {
    expect(getTranscriptScope("microsoft")).toBe(
      "OnlineMeetingTranscript.Read.All"
    );
  });

  it("returns the correct scope for Google", () => {
    expect(getTranscriptScope("google")).toBe(
      "https://www.googleapis.com/auth/drive.readonly"
    );
  });
});

describe("PROVIDERS config includes transcript scopes", () => {
  it("Microsoft scopes include OnlineMeetingTranscript.Read.All", () => {
    expect(PROVIDERS.microsoft.scopes).toContain(
      "OnlineMeetingTranscript.Read.All"
    );
  });

  it("Google scopes include drive.readonly", () => {
    expect(PROVIDERS.google.scopes).toContain(
      "https://www.googleapis.com/auth/drive.readonly"
    );
  });
});
