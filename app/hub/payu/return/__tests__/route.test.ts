import { describe, it, expect, vi, beforeEach } from "vitest";

const finalizePaymentFromPayuMock = vi.fn();
vi.mock("@/lib/payu/finalize", () => ({
  finalizePaymentFromPayu: finalizePaymentFromPayuMock,
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(fields: Record<string, string>) {
  const params = new URLSearchParams(fields);
  return new Request("http://localhost/hub/payu/return", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

describe("POST /hub/payu/return", () => {
  beforeEach(() => {
    finalizePaymentFromPayuMock.mockReset();
  });

  it("redirects to the dashboard with a success flag when finalize succeeds", async () => {
    finalizePaymentFromPayuMock.mockResolvedValue({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ txnid: "txn-1", status: "success" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://www.merito.ai/hub/account?payu=success");
  });

  it("redirects to the dashboard with a failed flag when finalize rejects", async () => {
    finalizePaymentFromPayuMock.mockResolvedValue({ ok: false, reason: "payment_failed" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ txnid: "txn-1", status: "failure" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://www.merito.ai/hub/account?payu=failed");
  });
});
