import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type FitmentReportResult = {
  strengths: string[];
  gaps: string[];
  cvFixes: string[];
};

const FitmentReportSchema = z.object({
  strengths: z.array(z.string()).min(1),
  gaps: z.array(z.string()).min(1),
  cvFixes: z.array(z.string()).min(1),
});

export async function generateFitmentReport(
  jdText: string,
  cvText: string,
  score: number
): Promise<FitmentReportResult> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          "You are writing a detailed fitment breakdown for a candidate who scored " +
          `${score}/10 against a job description.\n\n` +
          `Job description:\n${jdText}\n\n` +
          `Candidate CV:\n${cvText}\n\n` +
          "Return 2-4 concrete strengths (specific to this candidate and role, not generic), " +
          "2-4 concrete gaps costing them shortlists, and 2-4 specific, actionable suggestions " +
          "for how to improve their CV for this exact role.",
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
