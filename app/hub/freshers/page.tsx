import type { Metadata } from "next";
import { getAbsoluteUrl } from "@/lib/site";
import PersonaPage from "../personas/PersonaPage";
import { PERSONAS } from "../personas/data";

const p = PERSONAS.freshers;

export const metadata: Metadata = {
  title: p.metaTitle,
  description: p.metaDescription,
  openGraph: { title: p.metaTitle, description: p.metaDescription, url: getAbsoluteUrl("/hub/freshers") },
  alternates: { canonical: "/hub/freshers" },
};

export default function FreshersPage() {
  return <PersonaPage p={p} />;
}
