import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type FitmentResult = {
  score: number;
  verdict: string;
};

const FitmentSchema = z.object({
  score: z.number().min(0).max(10),
  verdict: z.string(),
});

export async function scoreFitment(jdText: string, cvText: string): Promise<FitmentResult> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content:
          "You are scoring how well a candidate's CV fits a job description.\n\n" +
          `Job description:\n${jdText}\n\n` +
          `Candidate CV:\n${cvText}\n\n` +
          "Score the fit from 0 to 10 (one decimal place) and give a single-sentence verdict explaining the score.",
      },
    ],
    output_config: {
      format: zodOutputFormat(FitmentSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable fitment result.");
  }

  return response.parsed_output;
}
