import { describe, it, expect } from "vitest";
import { to12h, to24h } from "@/components/ui/datetime-12h";

describe("to12h", () => {
  it("midnight is 12 AM", () => {
    expect(to12h(0)).toEqual({ hour: 12, meridiem: "AM" });
  });
  it("noon is 12 PM", () => {
    expect(to12h(12)).toEqual({ hour: 12, meridiem: "PM" });
  });
  it("1 AM stays 1 AM", () => {
    expect(to12h(1)).toEqual({ hour: 1, meridiem: "AM" });
  });
  it("11 AM stays 11 AM", () => {
    expect(to12h(11)).toEqual({ hour: 11, meridiem: "AM" });
  });
  it("1 PM is 13:00", () => {
    expect(to12h(13)).toEqual({ hour: 1, meridiem: "PM" });
  });
  it("11 PM is 23:00", () => {
    expect(to12h(23)).toEqual({ hour: 11, meridiem: "PM" });
  });
});

describe("to24h", () => {
  it("12 AM is midnight", () => {
    expect(to24h(12, "AM")).toBe(0);
  });
  it("12 PM is noon", () => {
    expect(to24h(12, "PM")).toBe(12);
  });
  it("1 AM is 1", () => {
    expect(to24h(1, "AM")).toBe(1);
  });
  it("11 AM is 11", () => {
    expect(to24h(11, "AM")).toBe(11);
  });
  it("1 PM is 13", () => {
    expect(to24h(1, "PM")).toBe(13);
  });
  it("11 PM is 23", () => {
    expect(to24h(11, "PM")).toBe(23);
  });
});

describe("round-trip", () => {
  it("to24h(to12h(h)) === h for every hour 0..23", () => {
    for (let h = 0; h < 24; h++) {
      const { hour, meridiem } = to12h(h);
      expect(to24h(hour, meridiem)).toBe(h);
    }
  });
});
