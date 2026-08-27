import { describe, it, expect, vi, afterEach } from "vitest";

// The component pulls in useRouter at module load; this repo has no DOM test
// renderer wired up (no @testing-library/react, vitest env is "node"), so we
// test the extracted fetch/compare helper directly -- the same shape as every
// other test in this folder. Mock mirrors lib/__tests__/adminAuth.test.ts.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { pollInterviewStatus } from "../InterviewStatusPoller";

describe("pollInterviewStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onChanged when the polled status differs from the current status", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ready" }) });
    const onChanged = vi.fn();
    await pollInterviewStatus("lead-1", "invited", onChanged);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("does not call onChanged while the status is unchanged", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "invited" }) });
    const onChanged = vi.fn();
    await pollInterviewStatus("lead-1", "invited", onChanged);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("swallows a failed poll (res.ok === false) without calling onChanged", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const onChanged = vi.fn();
    await pollInterviewStatus("lead-1", "invited", onChanged);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("swallows a network rejection without calling onChanged", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network"));
    const onChanged = vi.fn();
    await pollInterviewStatus("lead-1", "invited", onChanged);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
