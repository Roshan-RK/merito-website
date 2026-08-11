// Import the internal module directly, not the package root — root index.js
// has debug-mode code that tries reading a bundled test fixture on import
// and throws ENOENT outside pdf-parse's own working directory.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isPdf(file: File): boolean {
  return file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf");
}

function isDocx(file: File): boolean {
  return file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
}

export function isSupportedJdFile(file: File): boolean {
  return isPdf(file) || isDocx(file);
}

export async function extractJdText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const text = isPdf(file) ? (await pdfParse(buffer)).text : (await mammoth.extractRawText({ buffer })).value;

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Couldn't extract any text from that file.");
  }
  return trimmed;
}
