import type { Metadata } from "next";
import { getAbsoluteUrl } from "@/lib/site";
import PersonaPage from "../personas/PersonaPage";
import { PERSONAS } from "../personas/data";

const p = PERSONAS.leaders;

export const metadata: Metadata = {
  title: p.metaTitle,
  description: p.metaDescription,
  openGraph: { title: p.metaTitle, description: p.metaDescription, url: getAbsoluteUrl("/hub/leaders") },
  alternates: { canonical: "/hub/leaders" },
};

export default function LeadersPage() {
  return <PersonaPage p={p} />;
}
