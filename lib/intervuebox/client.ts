export type IntervueBoxErrorShape = {
  code: string;
  message: string;
  status: number;
  details?: unknown;
};

export class IntervueBoxError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(shape: IntervueBoxErrorShape) {
    super(shape.message);
    this.name = "IntervueBoxError";
    this.code = shape.code;
    this.status = shape.status;
    this.details = shape.details;
  }
}

function requireEnv(name: "INTERVUEBOX_API_KEY" | "INTERVUEBOX_BASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`IntervueBox is not configured (${name} missing).`);
  }
  return value;
}

export async function intervueBoxFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = requireEnv("INTERVUEBOX_API_KEY");
  const baseUrl = requireEnv("INTERVUEBOX_BASE_URL").replace(/\/$/, "");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store" });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // IntervueBox's real error responses don't always match the documented
    // { error: { code, message, status } } envelope — some endpoints return
    // a flat { message, error, statusCode } shape instead (message is a
    // string here, not an object). Check both so the real message text
    // (e.g. "Resume is still being parsed...") survives instead of falling
    // back to a generic string.
    const rawError = (body as { error?: unknown } | null)?.error;
    const nestedShape = rawError && typeof rawError === "object" ? (rawError as Partial<IntervueBoxErrorShape>) : {};
    const flatMessage = (body as { message?: unknown } | null)?.message;
    const message =
      nestedShape.message ??
      (typeof flatMessage === "string" ? flatMessage : undefined) ??
      `IntervueBox request failed with status ${response.status}`;
    throw new IntervueBoxError({
      code: nestedShape.code ?? "unknown_error",
      message,
      status: nestedShape.status ?? response.status,
      details: nestedShape.details,
    });
  }

  return body as T;
}
