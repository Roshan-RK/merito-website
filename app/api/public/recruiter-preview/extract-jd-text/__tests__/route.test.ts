import { describe, it, expect, vi, beforeEach } from "vitest";

const extractJdTextMock = vi.fn();
vi.mock("@/lib/jdFileText", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jdFileText")>();
  return { ...actual, extractJdText: extractJdTextMock };
});

async function importRoute() {
  return await import("../route");
}

function makeFile(name: string, type: string, sizeBytes = 100): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function request(file: File | null, key = "test-key") {
  const form = new FormData();
  if (file) form.set("jdFile", file);
  return new Request("http://localhost/api/public/recruiter-preview/extract-jd-text", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: form,
  });
}

describe("POST /api/public/recruiter-preview/extract-jd-text", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    extractJdTextMock.mockReset();
  });

  it("returns 401 when the key header is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request(makeFile("jd.pdf", "application/pdf"), ""));
    expect(response.status).toBe(401);
  });

  it("returns 400 when no file is uploaded", async () => {
    const { POST } = await importRoute();
    const response = await POST(request(null));
    expect(response.status).toBe(400);
  });

  it("returns 400 when the file exceeds 5MB", async () => {
    const { POST } = await importRoute();
    const response = await POST(request(makeFile("jd.pdf", "application/pdf", 6 * 1024 * 1024)));
    expect(response.status).toBe(400);
    expect(extractJdTextMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unsupported file type", async () => {
    const { POST } = await importRoute();
    const response = await POST(request(makeFile("jd.txt", "text/plain")));
    expect(response.status).toBe(400);
    expect(extractJdTextMock).not.toHaveBeenCalled();
  });

  it("returns 422 when extraction throws", async () => {
    extractJdTextMock.mockRejectedValue(new Error("Couldn't extract any text from that file."));
    const { POST } = await importRoute();
    const response = await POST(request(makeFile("jd.pdf", "application/pdf")));
    expect(response.status).toBe(422);
  });

  it("returns the extracted text on success", async () => {
    extractJdTextMock.mockResolvedValue("We need a backend engineer.");
    const { POST } = await importRoute();
    const response = await POST(request(makeFile("jd.pdf", "application/pdf")));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ jdText: "We need a backend engineer." });
  });
});
