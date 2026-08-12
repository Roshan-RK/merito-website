import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/recruiterEmails", () => ({
  sendRecruiterVerificationEmail: sendMock,
}));

const upsertMock = vi.fn().mockResolvedValue({ error: null });
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const maybeSingleMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table !== "recruiter_identities") throw new Error(`unexpected table ${table}`);
  return {
    upsert: upsertMock,
    select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    update: () => ({ eq: updateEqMock }),
  };
});
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importModule() {
  return await import("../recruiterIdentity");
}

describe("requestRecruiterEmailVerification", () => {
  beforeEach(() => {
    upsertMock.mockClear();
    sendMock.mockClear();
  });

  it("stores a token, company name, and sends the verification email", async () => {
    const { requestRecruiterEmailVerification } = await importModule();
    await requestRecruiterEmailVerification("Recruiter@Example.com", "Acme Inc");

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "recruiter@example.com", company_name: "Acme Inc" }),
      expect.objectContaining({ onConflict: "email" })
    );
    expect(sendMock).toHaveBeenCalledWith("Recruiter@Example.com", expect.any(String));
  });
});

describe("confirmRecruiterEmail", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    updateEqMock.mockClear();
  });

  it("returns null when the token doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { confirmRecruiterEmail } = await importModule();
    expect(await confirmRecruiterEmail("bad-token")).toBeNull();
  });

  it("returns null when the token has expired", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { email: "old@example.com", verification_sent_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    });
    const { confirmRecruiterEmail } = await importModule();
    expect(await confirmRecruiterEmail("expired-token")).toBeNull();
  });

  it("marks the email verified and returns it when the token is fresh", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { email: "fresh@example.com", verification_sent_at: new Date().toISOString() },
    });
    const { confirmRecruiterEmail } = await importModule();
    const result = await confirmRecruiterEmail("fresh-token");
    expect(result).toEqual({ email: "fresh@example.com" });
    expect(updateEqMock).toHaveBeenCalledWith("email", "fresh@example.com");
  });
});

describe("isRecruiterEmailVerified", () => {
  it("returns true only when verified_at is set", async () => {
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValueOnce({ data: { verified_at: "2026-08-01T00:00:00Z" } });
    maybeSingleMock.mockResolvedValueOnce({ data: { verified_at: null } });
    maybeSingleMock.mockResolvedValueOnce({ data: null });
    const { isRecruiterEmailVerified } = await importModule();
    expect(await isRecruiterEmailVerified("a@example.com")).toBe(true);
    expect(await isRecruiterEmailVerified("b@example.com")).toBe(false);
    expect(await isRecruiterEmailVerified("c@example.com")).toBe(false);
  });
});
