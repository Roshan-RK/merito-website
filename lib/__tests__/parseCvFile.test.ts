import { describe, it, expect } from "vitest";
import { parseCvFile, UnsupportedCvFileError } from "../parseCvFile";

function makeFile(bytes: Uint8Array<ArrayBuffer>, name: string, type: string): File {
  return new File([bytes], name, { type });
}

describe("parseCvFile", () => {
  it("rejects a file that is neither PDF nor DOCX by extension", async () => {
    const file = makeFile(new Uint8Array([1, 2, 3]), "resume.txt", "text/plain");
    await expect(parseCvFile(file)).rejects.toBeInstanceOf(UnsupportedCvFileError);
  });

  it("rejects a corrupt file with a PDF extension", async () => {
    const file = makeFile(new Uint8Array([0, 0, 0, 0]), "resume.pdf", "application/pdf");
    await expect(parseCvFile(file)).rejects.toBeInstanceOf(UnsupportedCvFileError);
  });
});
