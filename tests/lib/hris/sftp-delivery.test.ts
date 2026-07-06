import { describe, it, expect } from "vitest";
import {
  buildDeliveryFilename,
  MockSftpTransport,
} from "@/lib/hris/sftp-delivery";

// ---------------------------------------------------------------------------
// buildDeliveryFilename
// ---------------------------------------------------------------------------

describe("buildDeliveryFilename", () => {
  it("formats the standard filename pattern", () => {
    const result = buildDeliveryFilename(
      new Date("2026-07-03T14:00:00Z"),
      "Williams",
      "Jordan",
      "nc-lcmhca-v1",
    );
    expect(result).toBe("2026-07-03_supervision_williams_jordan_nc-lcmhca-v1.pdf");
  });

  it("sanitizes special characters in names", () => {
    const result = buildDeliveryFilename(
      new Date("2026-07-03"),
      "O'Brien-Smith",
      "Mary Jane",
      "nc-lcmhca-v1",
    );
    expect(result).toBe(
      "2026-07-03_supervision_o_brien_smith_mary_jane_nc-lcmhca-v1.pdf",
    );
  });

  it("handles empty name segments", () => {
    const result = buildDeliveryFilename(
      new Date("2026-07-03"),
      "",
      "",
      "nc-lcmhca-v1",
    );
    expect(result).toBe("2026-07-03_supervision___nc-lcmhca-v1.pdf");
  });

  it("preserves dashes and digits in names", () => {
    const result = buildDeliveryFilename(
      new Date("2026-01-15"),
      "Chen",
      "Sarah",
      "az-lpc-v2",
    );
    expect(result).toBe("2026-01-15_supervision_chen_sarah_az-lpc-v2.pdf");
  });

  it("collapses multiple underscores from special chars", () => {
    const result = buildDeliveryFilename(
      new Date("2026-07-03"),
      "De La Cruz",
      "Ana",
      "tx-lmft-v1",
    );
    expect(result).toBe(
      "2026-07-03_supervision_de_la_cruz_ana_tx-lmft-v1.pdf",
    );
  });
});

// ---------------------------------------------------------------------------
// MockSftpTransport
// ---------------------------------------------------------------------------

describe("MockSftpTransport", () => {
  it("records uploads without error", async () => {
    const transport = new MockSftpTransport();
    const data = Buffer.from("fake pdf content");

    await transport.upload(
      { legalEntityId: "le-100" },
      "/documents/test.pdf",
      data,
    );

    expect(transport.uploads).toHaveLength(1);
    expect(transport.uploads[0].remotePath).toBe("/documents/test.pdf");
    expect(transport.uploads[0].size).toBe(data.length);
  });

  it("tracks multiple uploads", async () => {
    const transport = new MockSftpTransport();

    await transport.upload(
      { legalEntityId: "le-100" },
      "/a.pdf",
      Buffer.from("a"),
    );
    await transport.upload(
      { legalEntityId: "le-100" },
      "/b.pdf",
      Buffer.from("bb"),
    );

    expect(transport.uploads).toHaveLength(2);
    expect(transport.uploads[0].size).toBe(1);
    expect(transport.uploads[1].size).toBe(2);
  });

  it("starts with empty uploads array", () => {
    const transport = new MockSftpTransport();
    expect(transport.uploads).toEqual([]);
  });
});
