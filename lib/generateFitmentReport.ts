import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type FitmentReportResult = {
  verdictSummary: string;
  categories: {
    category: "Technical Skills" | "Experience" | "Tools & Platforms" | "Soft Skills";
    matchedCount: number;
    totalCount: number;
    requirements: {
      requirement: string;
      matchLevel: "strong" | "partial" | "missing";
      isMustHave: boolean;
      evidence: string;
      note: string;
      interviewNote: string;
    }[];
  }[];
  actionPlan: { priority: number; action: string; why: string; effort: "quick" | "moderate" | "long-term" }[];
};

const FitmentReportSchema = z.object({
  verdictSummary: z.string(),
  categories: z
    .array(
      z.object({
        category: z.enum(["Technical Skills", "Experience", "Tools & Platforms", "Soft Skills"]),
        matchedCount: z.number(),
        totalCount: z.number(),
        requirements: z
          .array(
            z.object({
              requirement: z.string(),
              matchLevel: z.enum(["strong", "partial", "missing"]),
              isMustHave: z.boolean(),
              evidence: z.string(),
              note: z.string(),
              interviewNote: z.string(),
            })
          )
          .min(1),
      })
    )
    .min(1),
  actionPlan: z
    .array(
      z.object({
        priority: z.number(),
        action: z.string(),
        why: z.string(),
        effort: z.enum(["quick", "moderate", "long-term"]),
      })
    )
    .min(1),
});

export async function generateFitmentReport(
  jdText: string,
  cvText: string,
  score: number
): Promise<FitmentReportResult> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 3072,
    messages: [
      {
        role: "user",
        content:
          "You are writing a structured fitment assessment for a candidate who scored " +
          `${score}/10 against a job description.\n\n` +
          `Job description:\n${jdText}\n\n` +
          `Candidate CV:\n${cvText}\n\n` +
          "First, write a one-paragraph verdict summary: a narrative assessment of this " +
          "candidate's overall fit, written the way a human assessor would summarize their " +
          "findings before the details.\n\n" +
          "Then parse the job description's requirements and group them into exactly these " +
          'four categories: "Technical Skills", "Experience", "Tools & Platforms", ' +
          '"Soft Skills". Only include a category if the JD has requirements that fit it. ' +
          "For each category, report matchedCount (requirements assessed strong or partial) " +
          "and totalCount (all requirements in that category).\n\n" +
          "For each individual requirement: mark isMustHave true if the JD treats it as a " +
          "core/required qualification, false if it's listed as a bonus, preferred, or " +
          '"nice to have". Assess matchLevel as "strong", "partial", or "missing". Quote ' +
          'the exact line(s) from the CV as evidence (or write exactly "Not found in CV" ' +
          "if there is none). Write a one-sentence note explaining the assessment. Then " +
          "write a separate interviewNote: for a strong match, a tip on how to emphasize it " +
          "in an interview; for a partial or missing match, a tip on how to address it if " +
          "asked about it.\n\n" +
          "Finally, write a prioritized action plan: 3-5 concrete, ordered steps to improve " +
          'fit, each with a one-sentence why it matters, and an effort tag of "quick" ' +
          '(can do today), "moderate" (a focused week of work), or "long-term" (requires ' +
          "real experience over months), ordered by priority (1 = do this first). " +
          "Prioritize must-have gaps over nice-to-have gaps.",
      },
    ],
    output_config: {
      format: zodOutputFormat(FitmentReportSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable fitment report.");
  }

  return response.parsed_output;
}
