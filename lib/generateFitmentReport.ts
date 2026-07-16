import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type FitmentReportResult = {
  requirements: {
    requirement: string;
    matchLevel: "strong" | "partial" | "missing";
    evidence: string;
    note: string;
  }[];
  actionPlan: { priority: number; action: string; why: string }[];
};

const FitmentReportSchema = z.object({
  requirements: z
    .array(
      z.object({
        requirement: z.string(),
        matchLevel: z.enum(["strong", "partial", "missing"]),
        evidence: z.string(),
        note: z.string(),
      })
    )
    .min(1),
  actionPlan: z
    .array(
      z.object({
        priority: z.number(),
        action: z.string(),
        why: z.string(),
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
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content:
          "You are writing a detailed fitment analysis for a candidate who scored " +
          `${score}/10 against a job description.\n\n` +
          `Job description:\n${jdText}\n\n` +
          `Candidate CV:\n${cvText}\n\n` +
          "First, parse the job description into its distinct requirements " +
          "(skills, experience levels, qualifications, responsibilities). For each " +
          'requirement, assess the candidate\'s match as "strong", "partial", or ' +
          '"missing", quote the exact line(s) from the CV that support your ' +
          'assessment as evidence (or write exactly "Not found in CV" if there is ' +
          "no supporting evidence), and add a one-sentence note explaining the " +
          "assessment. Cover every distinct requirement you can identify in the JD.\n\n" +
          "Then write a prioritized action plan: 3-5 concrete, ordered steps the " +
          "candidate should take to improve their fit, each with a one-sentence " +
          "explanation of why it matters, ordered by priority (1 = do this first).",
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
