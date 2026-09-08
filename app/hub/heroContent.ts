// Segment-matched hero copy for /hub. The visitor's segment arrives as ?seg=
// on the campaign URL (see Sept 2026 CRO plan, sections 4-5). Only the hero
// headline, subcopy, CTA label, and the reassurance line change -- layout and
// every section below the hero are identical for all segments.
//
// No new product claims here: every line is a recombination of copy already
// used in the ad creative or already live elsewhere on the site.

export type HubSegment = "default" | "mid" | "senior";

export type HubHero = {
  eyebrow: string;
  headlineLead: string;
  headlineAccent: string;
  sub: string;
  ctaLabel: string;
  /** Short reassurance under the CTA row. */
  note: string;
};

const HEROES: Record<HubSegment, HubHero> = {
  default: {
    eyebrow: "Merito HUB · For Candidates",
    headlineLead: "Your CV says what you did.",
    headlineAccent: "Merito HUB proves what you're worth.",
    sub: "Whether you're applying for your first job, pushing for your next promotion, or making a quiet move to something bigger, Merito HUB scores your fit, shows you what to fix, and gets that proof in front of the people deciding.",
    ctaLabel: "Check my fitment score - free",
    note: "Free · No sign-up for your first score · Takes about 2 minutes",
  },
  mid: {
    eyebrow: "Merito HUB · Mid-career",
    headlineLead: "5 interviews. Still no offer?",
    headlineAccent: "Here's what your fit score shows.",
    sub: "Merito HUB scores your fit against the exact role you're going for, and shows you what's actually holding you back. Free, takes about 2 minutes.",
    ctaLabel: "Check your fit - free",
    note: "Free · No sign-up for your first score · Takes about 2 minutes",
  },
  senior: {
    eyebrow: "Merito HUB · Senior & confidential",
    headlineLead: "Know where you stand",
    headlineAccent: "before your next conversation.",
    sub: "A confidential fitment read for senior professionals weighing a move — no public profile, no noise. See exactly where you stand before it matters.",
    ctaLabel: "Check your fit privately - free",
    note: "Private by default · Nothing is visible to your employer or network unless you choose to share it",
  },
};

export function resolveSegment(raw: string | string[] | undefined): HubSegment {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
  if (value === "mid" || value === "senior") return value;
  return "default";
}

export function getHubHero(segment: HubSegment): HubHero {
  return HEROES[segment];
}
