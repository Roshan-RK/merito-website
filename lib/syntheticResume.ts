import { renderHtmlToPdf } from "@/lib/pdf/renderHtmlToPdf";

export type ScrapedCandidateFields = {
  name: string;
  headline: string;
  experience: { title: string; company: string; duration: string; description: string }[];
  education: { school: string; degree: string; duration: string }[];
  skills: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildResumeHtml(fields: ScrapedCandidateFields): string {
  const experienceHtml = fields.experience
    .map(
      (exp) => `
        <div style="margin-bottom: 12px;">
          <strong>${escapeHtml(exp.title)}</strong> — ${escapeHtml(exp.company)}<br/>
          <span style="color: #555; font-size: 12px;">${escapeHtml(exp.duration)}</span>
          <p style="margin: 4px 0 0;">${escapeHtml(exp.description)}</p>
        </div>`
    )
    .join("");

  const educationHtml = fields.education
    .map(
      (edu) => `
        <div style="margin-bottom: 8px;">
          <strong>${escapeHtml(edu.degree)}</strong> — ${escapeHtml(edu.school)}<br/>
          <span style="color: #555; font-size: 12px;">${escapeHtml(edu.duration)}</span>
        </div>`
    )
    .join("");

  const skillsHtml = fields.skills.map((skill) => escapeHtml(skill)).join(", ");

  return `<!doctype html>
<html>
<body style="font-family: Arial, sans-serif; padding: 32px; color: #111;">
  <h1 style="margin: 0 0 4px;">${escapeHtml(fields.name)}</h1>
  <p style="margin: 0 0 20px; color: #555;">${escapeHtml(fields.headline)}</p>
  <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Experience</h2>
  ${experienceHtml}
  <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Education</h2>
  ${educationHtml}
  <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Skills</h2>
  <p>${skillsHtml}</p>
</body>
</html>`;
}

export async function buildSyntheticResumePdf(fields: ScrapedCandidateFields): Promise<Buffer> {
  return renderHtmlToPdf(buildResumeHtml(fields));
}
