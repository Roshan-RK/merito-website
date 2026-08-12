import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();

// Three levers to shrink the actual work before padding the deadline for it
// (added 2026-08-12 after the resume-grounding fix roughly doubled worst-case
// prompt size against a timeout tuned for the JD-only case -- a slow/timed-out
// call falls back to the JD-only keyword list in lib/intervuebox/jobs.ts, the
// exact bug that fix addressed, so silently reintroducing it under load is
// the real risk here):
//
// 1. JD text sent into THIS prompt is capped separately from the 20,000-char
//    cap used for DB storage and the jobDescription field IntervueBox itself
//    receives -- real JDs are rarely near that ceiling, so this only trims
//    the genuine long tail.
const LLM_JD_CHAR_LIMIT = 10000;
// 2. A resume's opening ~6000 chars (name, headline, most recent/relevant
//    roles) is enough to judge tool/skill relevance -- the rest isn't needed
//    for this judgment call.
const LLM_RESUME_CHAR_LIMIT = 6000;
// 3. The actual output is a short title plus at most 10 short skill strings
//    -- realistically well under 200 tokens of JSON. No reason to leave 5x
//    headroom (the old 1024) over what the schema can produce; a tighter
//    ceiling caps worst-case generation time directly.
const LLM_MAX_OUTPUT_TOKENS = 600;
// Only bumped modestly (6000ms -> 8000ms) because levers 1-3 above already
// remove most of the regression; this is margin on top of a smaller prompt,
// not a substitute for shrinking it.
const LLM_TIMEOUT_MS = 8000;

const SkillsSchema = z.object({
  skills: z
    .array(z.string())
    .describe(
      "Final skill list after self-critique, ordered by importance per the JD's own emphasis (role title and mandatory/must-have sections first, generic soft skills last). Each entry must be a short, standard skill keyword (1-4 words, e.g. 'Partner Management', 'AWS', 'Stakeholder Management') -- even when the skill is inferred from context rather than a literal word in the text, never a paraphrased sentence or the raw phrase from the source text."
    ),
});

function buildContextBlock(jobDescription: string, resumeText?: string): string {
  const truncatedJd = jobDescription.slice(0, LLM_JD_CHAR_LIMIT);
  const truncatedResume = resumeText?.slice(0, LLM_RESUME_CHAR_LIMIT);
  return `Job description:
${truncatedJd}
${
  truncatedResume
    ? `\nCandidate's resume:\n${truncatedResume}\n\nGround your picks in this specific candidate: prefer skills the JD asks for AND the resume shows real evidence of (tools/technologies they've actually used, not adjacent buzzwords). Don't include a JD-mentioned skill the resume gives zero grounding for unless it's core to the role's primary function -- scoring an interview on a skill the candidate has never touched isn't a fair evaluation.`
    : ""
}`;
}

const PROMPT_TEMPLATE = (jobDescription: string, max: number, resumeText?: string) => `You are an experienced technical recruiter screening candidates for this role. Read the job description below and identify the skills that actually determine whether a candidate is a strong fit -- not generic buzzwords, and not skills you're inferring without support from the text.

${buildContextBlock(jobDescription, resumeText)}
Think like a recruiter: what would you actually screen candidates on for this specific role? Silently self-critique your first instinct -- drop anything too generic or unsupported by the text -- then output only your final answer. Return at most ${max} skills, ordered by how much the JD itself emphasizes them (role title and mandatory/must-have sections first, generic soft skills last). Output each skill as a short, standard keyword (1-4 words) -- if you infer a skill from context rather than seeing it spelled out (e.g. "led AWS partnerships" implies "Partner Management"), still name it as a clean keyword, not the sentence you inferred it from.`;

// IntervueBox can only analyze a fixed number of skills per interview slot,
// and the whole point of LLM extraction is catching skills a fixed keyword
// list never will (see lib/intervuebox/jobs.ts). Self-critique lives in the
// prompt text, not a separate output field -- live-measured 2026-08-01:
// adding a "recruiterNotes" scratchpad field before the skills array (to
// force visible reasoning) took the call from ~3s to ~11s, since the model
// has to generate a full paragraph before the real answer. fitment-check's
// own requirement is least-possible-time, so the instruction guides a
// single fast pass instead of paying for a written-out critique.
export async function extractSkillsWithLLM(jobDescription: string, max: number, resumeText?: string): Promise<string[]> {
  const response = await client.messages.parse(
    {
      model: "claude-haiku-4-5",
      max_tokens: LLM_MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: PROMPT_TEMPLATE(jobDescription, max, resumeText) }],
      output_config: { format: zodOutputFormat(SkillsSchema) },
    },
    { timeout: LLM_TIMEOUT_MS }
  );

  const skills = response.parsed_output?.skills ?? [];
  return skills.slice(0, max);
}
