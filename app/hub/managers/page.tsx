import type { Metadata } from "next";
import { getAbsoluteUrl } from "@/lib/site";
import PersonaPage from "../personas/PersonaPage";
import { PERSONAS } from "../personas/data";

const p = PERSONAS.managers;

export const metadata: Metadata = {
  title: p.metaTitle,
  description: p.metaDescription,
  openGraph: { title: p.metaTitle, description: p.metaDescription, url: getAbsoluteUrl("/hub/managers") },
  alternates: { canonical: "/hub/managers" },
};

export default function ManagersPage() {
  return <PersonaPage p={p} />;
}
