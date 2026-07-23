export type TraitKey = "E" | "A" | "C" | "ES" | "O";

export type Item = { id: number; t: TraitKey; k: "+" | "-"; s: string };
export type ImpressionItem = { id: number; s: string };

export const ITEMS: Item[] = [
  { id: 1, t: "E", k: "+", s: "I am the life of the party." },
  { id: 2, t: "E", k: "+", s: "I feel comfortable around people." },
  { id: 3, t: "E", k: "+", s: "I start conversations." },
  { id: 4, t: "E", k: "+", s: "I talk to a lot of different people at parties." },
  { id: 5, t: "E", k: "+", s: "I don't mind being the center of attention." },
  { id: 6, t: "E", k: "+", s: "I make friends easily." },
  { id: 7, t: "E", k: "-", s: "I don't talk a lot." },
  { id: 8, t: "E", k: "-", s: "I keep in the background." },
  { id: 9, t: "E", k: "-", s: "I have little to say." },
  { id: 10, t: "E", k: "-", s: "I don't like to draw attention to myself." },
  { id: 11, t: "E", k: "-", s: "I am quiet around strangers." },
  { id: 12, t: "E", k: "-", s: "I find it difficult to approach others." },
  { id: 13, t: "A", k: "+", s: "I am interested in people." },
  { id: 14, t: "A", k: "+", s: "I sympathize with others' feelings." },
  { id: 15, t: "A", k: "+", s: "I have a soft heart." },
  { id: 16, t: "A", k: "+", s: "I take time out for others." },
  { id: 17, t: "A", k: "+", s: "I feel others' emotions." },
  { id: 18, t: "A", k: "+", s: "I make people feel at ease." },
  { id: 19, t: "A", k: "-", s: "I feel little concern for others." },
  { id: 20, t: "A", k: "-", s: "I insult people." },
  { id: 21, t: "A", k: "-", s: "I am not interested in other people's problems." },
  { id: 22, t: "A", k: "-", s: "I am not really interested in others." },
  { id: 23, t: "A", k: "-", s: "I have a sharp tongue." },
  { id: 24, t: "A", k: "-", s: "I contradict others." },
  { id: 25, t: "C", k: "+", s: "I am always prepared." },
  { id: 26, t: "C", k: "+", s: "I pay attention to details." },
  { id: 27, t: "C", k: "+", s: "I get chores done right away." },
  { id: 28, t: "C", k: "+", s: "I like order." },
  { id: 29, t: "C", k: "+", s: "I follow a schedule." },
  { id: 30, t: "C", k: "+", s: "I am exacting in my work." },
  { id: 31, t: "C", k: "-", s: "I leave my belongings around." },
  { id: 32, t: "C", k: "-", s: "I make a mess of things." },
  { id: 33, t: "C", k: "-", s: "I often forget to put things back in their proper place." },
  { id: 34, t: "C", k: "-", s: "I shirk my duties." },
  { id: 35, t: "C", k: "-", s: "I waste my time." },
  { id: 36, t: "C", k: "-", s: "I do just enough work to get by." },
  { id: 37, t: "ES", k: "+", s: "I am relaxed most of the time." },
  { id: 38, t: "ES", k: "+", s: "I seldom feel blue." },
  { id: 39, t: "ES", k: "+", s: "I am not easily bothered by things." },
  { id: 40, t: "ES", k: "+", s: "I rarely get irritated." },
  { id: 41, t: "ES", k: "+", s: "I remain calm under pressure." },
  { id: 42, t: "ES", k: "+", s: "I feel comfortable with myself." },
  { id: 43, t: "ES", k: "-", s: "I get stressed out easily." },
  { id: 44, t: "ES", k: "-", s: "I worry about things." },
  { id: 45, t: "ES", k: "-", s: "I am easily disturbed." },
  { id: 46, t: "ES", k: "-", s: "I get upset easily." },
  { id: 47, t: "ES", k: "-", s: "I have frequent mood swings." },
  { id: 48, t: "ES", k: "-", s: "I panic easily." },
  { id: 49, t: "O", k: "+", s: "I have a vivid imagination." },
  { id: 50, t: "O", k: "+", s: "I have excellent ideas." },
  { id: 51, t: "O", k: "+", s: "I am quick to understand things." },
  { id: 52, t: "O", k: "+", s: "I use difficult words." },
  { id: 53, t: "O", k: "+", s: "I spend time reflecting on things." },
  { id: 54, t: "O", k: "+", s: "I am full of ideas." },
  { id: 55, t: "O", k: "-", s: "I have difficulty understanding abstract ideas." },
  { id: 56, t: "O", k: "-", s: "I am not interested in abstract ideas." },
  { id: 57, t: "O", k: "-", s: "I do not have a good imagination." },
  { id: 58, t: "O", k: "-", s: "I avoid difficult reading material." },
  { id: 59, t: "O", k: "-", s: "I will not probe deeply into a subject." },
  { id: 60, t: "O", k: "-", s: "I avoid philosophical discussions." },
];

export const IMPRESSION_ITEMS: ImpressionItem[] = [
  { id: 101, s: "I always admit it when I make a mistake." },
  { id: 102, s: "I never lie." },
  { id: 103, s: "I always keep my promises." },
  { id: 104, s: "I have never taken anything that didn't belong to me." },
  { id: 105, s: "I have never hurt someone's feelings." },
];

// Consistency-check pairs: items that should draw similar answers.
export const CONSISTENCY_PAIRS: [number, number][] = [
  [7, 9],
  [21, 22],
  [32, 33],
  [47, 46],
  [55, 56],
  [50, 54],
];

export const TRAITS: TraitKey[] = ["E", "A", "C", "ES", "O"];

export const TRAIT_NAME: Record<TraitKey, string> = {
  E: "Extroversion",
  A: "Agreeableness",
  C: "Conscientiousness",
  ES: "Emotional Stability",
  O: "Openness to Experience",
};

export const BANDS = ["Very Low", "Low", "Average", "High", "Very High"] as const;

export const TRAIT_MEANING: Record<TraitKey, string> = {
  E: "Extroversion is about where a person draws their energy. High scorers are outgoing, talkative and stimulated by being around others; low scorers (introverts) are more reserved and recharge through quieter, independent time. It shapes how someone shows up in meetings, teams and client conversations.",
  A: "Agreeableness reflects how much someone prioritises cooperation and harmony over self-interest. High scorers are warm, trusting and accommodating; low scorers are more direct, competitive and willing to challenge. It shapes teamwork, conflict and negotiation.",
  C: "Conscientiousness captures how organised, disciplined and goal-directed a person is. High scorers plan ahead, follow through and attend to detail; low scorers are more flexible and spontaneous but less structured. Of the five traits, it is the most consistent predictor of job performance across roles.",
  ES: "Emotional Stability describes how calm and resilient someone stays under pressure — its opposite pole is neuroticism. High scorers are steady and bounce back quickly from setbacks; low scorers feel stress more intensely and react more strongly to it. It shapes composure in demanding work.",
  O: "Openness to Experience reflects curiosity and appetite for new ideas. High scorers are imaginative, comfortable with abstraction and drawn to novelty; low scorers are practical, conventional and prefer proven methods. It shapes how someone responds to change, learning and creative problem-solving.",
};

type WorkLevel = "high" | "avg" | "low";
export const TRAIT_WORK_IMPLICATION: Record<TraitKey, Record<WorkLevel, (name: string) => string>> = {
  E: {
    high: (n) => `${n} is likely to energise meetings, build networks quickly and be comfortable in visible, client-facing or team-leading roles. Watch-out: a pull toward talking over listening, and restlessness during long solo stretches. Best fit: collaborative, people-dense environments.`,
    avg: (n) => `${n} can flex between collaborative and independent work, contributing in groups without needing constant interaction. This adaptability suits most roles — there's no strong social pull in either direction to manage around.`,
    low: (n) => `${n} tends to do focused, independent work well and to listen more than they speak. They may be quieter in large meetings and prefer written or one-to-one communication. Best fit: roles with genuine deep-work time; give notice before putting them on the spot.`,
  },
  A: {
    high: (n) => `${n} is likely to be a cooperative, trusted teammate who defuses conflict and supports colleagues. Watch-out: difficulty saying no, and conceding too readily in negotiations. Best fit: service, support, account management and tight-knit teams.`,
    avg: (n) => `${n} balances warmth with candour — backing the team but able to push back when it matters. This middle position is versatile across most roles.`,
    low: (n) => `${n} is direct and comfortable with disagreement, which helps in negotiation, quality control and roles that require hard calls. Watch-out: coming across as blunt or dismissive of others' views. Best fit: roles where candour and objectivity matter more than harmony.`,
  },
  C: {
    high: (n) => `${n} is likely to be organised, reliable and thorough — strong on deadlines, detail and follow-through. Watch-out: rigidity or perfectionism when priorities shift suddenly. Best fit: roles that reward rigour, process and accountability.`,
    avg: (n) => `${n} is dependable without being rigid, keeping work on track while staying adaptable when plans change. A safe fit for most roles; light external structure helps at the margins.`,
    low: (n) => `${n} is flexible, spontaneous and comfortable improvising, which suits fast-changing or creative settings. Watch-out: missed details and deadlines without structure. Best fit: fluid roles — pair with clear deadlines and accountability.`,
  },
  ES: {
    high: (n) => `${n} is likely to stay composed under pressure, absorb setbacks and bring steadiness to a stressed team. Watch-out: occasionally under-reacting to genuine risks. Best fit: high-pressure, high-stakes or fast-changing roles.`,
    avg: (n) => `${n} handles normal pressure well, with typical ups and downs under heavier load — resilient enough for most roles without being unusually unflappable.`,
    low: (n) => `${n} feels pressure keenly and stays alert to what could go wrong, which can sharpen risk-spotting and careful work. Watch-out: stress spilling into performance during high-tension periods. Best fit: calmer, predictable environments, or strong support through crunch.`,
  },
  O: {
    high: (n) => `${n} is likely to embrace change, generate ideas and enjoy learning — valuable in strategy, innovation and creative problem-solving. Watch-out: boredom with routine and a tendency to over-complicate simple tasks. Best fit: roles with variety, autonomy and intellectual challenge.`,
    avg: (n) => `${n} blends practicality with curiosity — open to new approaches while staying grounded in what actually works. Versatile across both execution and improvement-focused roles.`,
    low: (n) => `${n} is practical and consistent, favouring proven methods and dependable execution. Watch-out: resistance to change and less appetite for ambiguity. Best fit: stable, process-driven roles where consistency beats novelty.`,
  },
};

export const ALL_ITEM_IDS: number[] = [...ITEMS.map((i) => i.id), ...IMPRESSION_ITEMS.map((i) => i.id)];

export type Answers = Record<number, number>;

export type TraitScore = { raw: number; pct: number; band: number };
export type Scores = Record<TraitKey, TraitScore>;

export type Validity = {
  meanRaw: number;
  pctMid: number;
  incon: number;
  sd: number;
};

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Every trait item (60) and impression-management item (5) must be answered 1-5. */
export function isCompleteAnswerSet(answers: Answers): boolean {
  return ALL_ITEM_IDS.every((id) => {
    const v = answers[id];
    return typeof v === "number" && v >= 1 && v <= 5 && Number.isInteger(v);
  });
}

export function scoreTrait(answers: Answers, trait: TraitKey): TraitScore {
  const items = ITEMS.filter((i) => i.t === trait);
  let raw = 0;
  items.forEach((it) => {
    const r = answers[it.id];
    raw += it.k === "+" ? r : 6 - r;
  });
  const pct = Math.round(((raw - 12) / 48) * 100);
  let band = Math.floor(pct / 20);
  if (band > 4) band = 4;
  if (band < 0) band = 0;
  return { raw, pct, band };
}

export function scoreAllTraits(answers: Answers): Scores {
  const scores = {} as Scores;
  TRAITS.forEach((t) => {
    scores[t] = scoreTrait(answers, t);
  });
  return scores;
}

export function computeValidity(answers: Answers): Validity {
  const raw = ITEMS.map((it) => answers[it.id]);
  return {
    meanRaw: average(raw),
    pctMid: (100 * raw.filter((r) => r === 3).length) / raw.length,
    incon: average(CONSISTENCY_PAIRS.map(([a, b]) => Math.abs(answers[a] - answers[b]))),
    sd: average(IMPRESSION_ITEMS.map((it) => answers[it.id])),
  };
}

export type ValidityFlag =
  | "agreement (yea-saying) bias"
  | "disagreement bias"
  | "central-tendency (fence-sitting)"
  | "inconsistent / careless responding"
  | "socially desirable responding (faking good)";

export function validityFlags(v: Validity): ValidityFlag[] {
  const flags: ValidityFlag[] = [];
  if (v.meanRaw >= 3.6) flags.push("agreement (yea-saying) bias");
  else if (v.meanRaw <= 2.4) flags.push("disagreement bias");
  if (v.pctMid >= 40) flags.push("central-tendency (fence-sitting)");
  if (v.incon >= 1.5) flags.push("inconsistent / careless responding");
  if (v.sd >= 4) flags.push("socially desirable responding (faking good)");
  return flags;
}

export function traitLevel(pct: number): WorkLevel {
  if (pct >= 60) return "high";
  if (pct <= 40) return "low";
  return "avg";
}

/** No name is collected at sign-in (magic-link only) — derive a display name from the email local-part. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] || "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "You";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
