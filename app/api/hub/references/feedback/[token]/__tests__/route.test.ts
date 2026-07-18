import { describe, it, expect, vi, beforeEach } from "vitest";

const validateRefereeTokenMock = vi.fn();
const consumeRefereeTokenMock = vi.fn();
const recordRefereeFeedbackMock = vi.fn();
const recordRefereeDeclineMock = vi.fn();
const getRefereeNameMock = vi.fn();

vi.mock("@/lib/referenceTokens", () => ({
  validateRefereeToken: validateRefereeTokenMock,
  consumeRefereeToken: consumeRefereeTokenMock,
}));
vi.mock("@/lib/referenceChecks", () => ({
  recordRefereeFeedback: recordRefereeFeedbackMock,
  recordRefereeDecline: recordRefereeDeclineMock,
  getRefereeName: getRefereeNameMock,
}));

async function importRoute() {
  return await import("../route");
}

function params(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("GET /api/hub/references/feedback/[token]", () => {
  beforeEach(() => {
    validateRefereeTokenMock.mockReset();
    getRefereeNameMock.mockReset();
  });

  it("returns valid:false when the token is invalid", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: false, reason: "expired" });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost"), params("bad-token"));
    const body = await response.json();
    expect(body).toEqual({ valid: false, reason: "expired" });
  });

  it("returns the referee name when the token is valid", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: true, refereeId: "referee-1" });
    getRefereeNameMock.mockResolvedValue("Jane Doe");
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost"), params("good-token"));
    const body = await response.json();
    expect(body).toEqual({ valid: true, refereeName: "Jane Doe" });
  });
});

describe("POST /api/hub/references/feedback/[token]", () => {
  beforeEach(() => {
    validateRefereeTokenMock.mockReset();
    consumeRefereeTokenMock.mockReset();
    recordRefereeFeedbackMock.mockReset();
    recordRefereeDeclineMock.mockReset();
  });

  function body(payload: unknown) {
    return new Request("http://localhost", { method: "POST", body: JSON.stringify(payload) });
  }

  it("returns 410 when the token is not valid", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: false, reason: "used" });
    const { POST } = await importRoute();
    const response = await POST(body({ declined: true }), params("used-token"));
    expect(response.status).toBe(410);
  });

  it("records feedback and consumes the token", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: true, refereeId: "referee-1" });
    recordRefereeFeedbackMock.mockResolvedValue(undefined);
    consumeRefereeTokenMock.mockResolvedValue(undefined);

    const ratings = [
      { category: "knowledge-application", value: 5 },
      { category: "initiative", value: 5 },
      { category: "teamwork", value: 5 },
      { category: "communication", value: 5 },
      { category: "discipline", value: 5 },
      { category: "problem-solving", value: 5 },
      { category: "leadership-skills", value: 5 },
    ];

    const { POST } = await importRoute();
    const response = await POST(body({ ratings, overallFeedback: "Great." }), params("good-token"));
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ ok: true });
    expect(recordRefereeFeedbackMock).toHaveBeenCalledWith("referee-1", {
      ratings,
      overallFeedback: "Great.",
    });
    expect(consumeRefereeTokenMock).toHaveBeenCalledWith("good-token");
  });

  it("records a decline and consumes the token", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: true, refereeId: "referee-1" });
    recordRefereeDeclineMock.mockResolvedValue(undefined);
    consumeRefereeTokenMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(body({ declined: true }), params("good-token"));
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ ok: true });
    expect(recordRefereeDeclineMock).toHaveBeenCalledWith("referee-1");
    expect(consumeRefereeTokenMock).toHaveBeenCalledWith("good-token");
  });

  it("returns 400 when the body matches neither shape", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: true, refereeId: "referee-1" });
    const { POST } = await importRoute();
    const response = await POST(body({}), params("good-token"));
    expect(response.status).toBe(400);
    expect(consumeRefereeTokenMock).not.toHaveBeenCalled();
  });
});
