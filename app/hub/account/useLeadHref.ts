"use client";
import { useSearchParams } from "next/navigation";

export function appendLeadParam(path: string, lead: string | null): string {
  if (!lead) return path;
  if (/[?&]lead=/.test(path)) return path;
  return `${path}${path.includes("?") ? "&" : "?"}lead=${encodeURIComponent(lead)}`;
}

// Returns a builder that stamps the currently-active ?lead= onto an internal
// hub link, so a switch made in the TopBar survives navigating via the
// sidebar / any in-app link. The URL param stays the single source of truth
// (Phase 3c) -- this just carries it.
export function useLeadHref(): (path: string) => string {
  const lead = useSearchParams().get("lead");
  return (path: string) => appendLeadParam(path, lead);
}
