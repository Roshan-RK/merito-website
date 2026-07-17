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
    const errorShape = (body as { error?: Partial<IntervueBoxErrorShape> } | null)?.error ?? {};
    throw new IntervueBoxError({
      code: errorShape.code ?? "unknown_error",
      message: errorShape.message ?? `IntervueBox request failed with status ${response.status}`,
      status: errorShape.status ?? response.status,
      details: errorShape.details,
    });
  }

  return body as T;
}
