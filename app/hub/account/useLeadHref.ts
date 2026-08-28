"use client";
import { useSearchParams } from "next/navigation";

export function appendLeadParam(path: string, lead: string | null): string {
  if (!lead) return path;
  if (/[?&]lead=/.test(path)) return path;
  const hash = path.indexOf("#");
  const base = hash === -1 ? path : path.slice(0, hash);
  const frag = hash === -1 ? "" : path.slice(hash);
  return `${base}${base.includes("?") ? "&" : "?"}lead=${encodeURIComponent(lead)}${frag}`;
}

// Returns a builder that stamps the currently-active ?lead= onto an internal
// hub link, so a switch made in the TopBar survives navigating via the
// sidebar / any in-app link. The URL param stays the single source of truth
// (Phase 3c) -- this just carries it.
export function useLeadHref(): (path: string) => string {
  const lead = useSearchParams().get("lead");
  return (path: string) => appendLeadParam(path, lead);
}
