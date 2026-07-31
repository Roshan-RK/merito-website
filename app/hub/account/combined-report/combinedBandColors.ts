type ColorPair = { textColor: string; trackColor: string };

// The shared getMatchBand/getScoreBand (ResumeMatchGauge.tsx,
// InterviewScoreGauge.tsx) are out of scope to modify, so their hub-hex
// output gets translated to the specimen's palette here instead. Keyed
// by hub's own textColor since that's the only distinguishing value hub
// returns per tier. `label` passes through unchanged — only the colors
// are hub-specific, the tier wording ("Excellent match", "Developing",
// etc.) stays as-is.
const LIGHT: Record<string, ColorPair> = {
  "#16803c": { textColor: "#1E8F5E", trackColor: "#E7F5EE" }, // strong
  "#4b4b4d": { textColor: "#BD7E12", trackColor: "#FBF1DF" }, // mid (hub's neutral-gray "mid" tier)
  "#ed1a24": { textColor: "#95324B", trackColor: "#F6E7EB" }, // weak
};

const DARK: Record<string, ColorPair> = {
  "#16803c": { textColor: "#3FCB8C", trackColor: "rgba(255,255,255,0.12)" },
  "#4b4b4d": { textColor: "#BD7E12", trackColor: "rgba(255,255,255,0.12)" },
  "#ed1a24": { textColor: "#E8798F", trackColor: "rgba(255,255,255,0.12)" },
};

export function remapBand<T extends ColorPair>(band: T): T {
  return { ...band, ...(LIGHT[band.textColor] ?? {}) };
}

export function remapBandDark<T extends ColorPair>(band: T): T {
  return { ...band, ...(DARK[band.textColor] ?? {}) };
}
