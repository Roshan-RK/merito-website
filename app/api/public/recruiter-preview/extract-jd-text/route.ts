import { isSupportedJdFile, extractJdText } from "@/lib/jdFileText";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const file = form.get("jdFile");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "That file is too large — please upload a JD under 5MB." }, { status: 400 });
  }
  if (!isSupportedJdFile(file)) {
    return Response.json({ error: "Unsupported file type. Please upload a PDF or DOCX file." }, { status: 400 });
  }

  try {
    const jdText = await extractJdText(file);
    return Response.json({ jdText });
  } catch {
    return Response.json({ error: "Couldn't read that file — try pasting the JD instead." }, { status: 422 });
  }
}
