import { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const staticRoutes = [
  { path: "/",               priority: 1.0,  changeFrequency: "weekly"  },
  { path: "/about",          priority: 0.7,  changeFrequency: "monthly" },
  { path: "/contact",        priority: 0.6,  changeFrequency: "monthly" },
  { path: "/meritoways",     priority: 0.8,  changeFrequency: "monthly" },
  { path: "/offervault",     priority: 0.8,  changeFrequency: "monthly" },
  { path: "/reftrack",       priority: 0.8,  changeFrequency: "monthly" },
  { path: "/insights",       priority: 0.9,  changeFrequency: "daily"   },
  { path: "/hub",            priority: 0.9,  changeFrequency: "weekly"  },
  { path: "/hub/freshers",   priority: 0.8,  changeFrequency: "monthly" },
  { path: "/hub/managers",   priority: 0.8,  changeFrequency: "monthly" },
  { path: "/hub/leaders",    priority: 0.8,  changeFrequency: "monthly" },
  { path: "/privacy",        priority: 0.3,  changeFrequency: "yearly"  },
  { path: "/terms",          priority: 0.3,  changeFrequency: "yearly"  },
  { path: "/refund-policy",  priority: 0.3,  changeFrequency: "yearly"  },
] as const;

const articleSlugs = [
  "invisible-burn", "human-centric-ai", "right-path", "choose-right",
  "ditch-internal", "retain-top-1", "modern-playbook", "slow-hiring-costs",
  "strategy-2026", "hire-from-within", "rest-to-reality", "resume-is-dead",
  "degree-doesnt-define", "acquired-intelligence-talent", "recruitment-as-sales",
  "ice-in-hiring", "improve-hiring-experience",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const statics = staticRoutes.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  const articles = articleSlugs.map((slug) => ({
    url: `${siteUrl}/insights/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...statics, ...articles];
}
