import { describe, it, expect } from "vitest";
import { isInterviewGenerating } from "../ProgressRail";

describe("isInterviewGenerating", () => {
  const invitedAt = "2026-08-10T10:00:00.000Z";
  const invitedAtMs = new Date(invitedAt).getTime();

  it("is false when there's no interview row", () => {
    expect(isInterviewGenerating("not_started", null, "mid", invitedAtMs)).toBe(false);
  });

  it("is false once the report is ready", () => {
    expect(isInterviewGenerating("ready", invitedAt, "mid", invitedAtMs + 60 * 60_000)).toBe(false);
  });

  it("is false invited but no invited timestamp is known", () => {
    expect(isInterviewGenerating("invited", null, "mid", invitedAtMs + 60 * 60_000)).toBe(false);
  });

  it("stays 'invited' (not generating) before the mid-level 30min slot elapses", () => {
    expect(isInterviewGenerating("invited", invitedAt, "mid", invitedAtMs + 29 * 60_000)).toBe(false);
  });

  it("flips to generating once the mid-level 30min slot elapses", () => {
    expect(isInterviewGenerating("invited", invitedAt, "mid", invitedAtMs + 30 * 60_000)).toBe(true);
  });

  it("entry level uses the same 30min slot as mid", () => {
    expect(isInterviewGenerating("invited", invitedAt, "entry", invitedAtMs + 30 * 60_000)).toBe(true);
  });

  it("stays 'invited' before the senior-level 45min slot elapses", () => {
    expect(isInterviewGenerating("invited", invitedAt, "senior", invitedAtMs + 44 * 60_000)).toBe(false);
  });

  it("flips to generating once the senior-level 45min slot elapses", () => {
    expect(isInterviewGenerating("invited", invitedAt, "senior", invitedAtMs + 45 * 60_000)).toBe(true);
  });

  it("isInterviewGenerating is false for a terminated interview regardless of elapsed time", () => {
    const invitedAt = new Date(0).toISOString();
    expect(isInterviewGenerating("terminated", invitedAt, "mid", 999_999_999)).toBe(false);
  });
});
