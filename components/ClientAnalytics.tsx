"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Hrefs that represent a step toward the fitment funnel. A click on any of
// these is a `cta_click` (Sept CRO plan, section 16 / W01).
const CTA_HREF_PATTERNS = ["fit-checker", "#pricing"];

export default function ClientAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    const w = window as unknown as { dataLayer?: unknown[] };
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: "page_view", page_path: pathname });
    }
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("a[href], [data-cta]");
      if (!el) return;
      const href = el.getAttribute("href") ?? "";
      const isCta =
        el.hasAttribute("data-cta") || CTA_HREF_PATTERNS.some((p) => href.includes(p));
      if (!isCta) return;
      track("cta_click", {
        cta_label: (el.getAttribute("data-cta") || el.textContent || "").trim().slice(0, 80),
        cta_href: href,
        page_path: pathname,
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return null;
}
