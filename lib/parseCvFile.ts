import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export class UnsupportedCvFileError extends Error {
  constructor(message = "Unsupported or unreadable CV file.") {
    super(message);
    this.name = "UnsupportedCvFileError";
  }
}

export async function parseCvFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    try {
      const result = await pdfParse(buffer);
      const text = result.text.trim();
      if (!text) throw new Error("empty");
      return text;
    } catch {
      throw new UnsupportedCvFileError();
    }
  }

  if (name.endsWith(".docx")) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) throw new Error("empty");
      return text;
    } catch {
      throw new UnsupportedCvFileError();
    }
  }

  throw new UnsupportedCvFileError();
}
