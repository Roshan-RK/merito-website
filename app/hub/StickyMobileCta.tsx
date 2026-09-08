"use client";

import { useEffect, useState } from "react";

/**
 * Mobile-only sticky CTA. Paid social traffic is heavily mobile (Sept CRO plan,
 * section 15 / W05); this keeps the primary action reachable once the visitor
 * has scrolled past the hero without adding anything on desktop.
 */
export default function StickyMobileCta({
  label,
  href = "#fit-checker",
}: {
  label: string;
  href?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 620);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="sm:hidden"
      aria-hidden={!show}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        padding: "12px 12px 14px",
        transform: show ? "translateY(0)" : "translateY(140%)",
        transition: "transform 0.25s ease",
        background: "linear-gradient(to top, rgba(255,255,255,0.98) 60%, rgba(255,255,255,0))",
      }}
    >
      <a
        href={href}
        data-cta="sticky_mobile_cta"
        className="flex items-center justify-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24]"
        style={{ height: 52, borderRadius: 10, fontSize: 15, boxShadow: "0px 6px 20px rgba(236,34,40,0.4)" }}
      >
        {label}
      </a>
    </div>
  );
}
