"use client";

import { useEffect, useState } from "react";

export default function PublicReportRail({ sections }: { sections: { key: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.key);

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.key))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 72,
        flexShrink: 0,
        borderRight: "1px solid #E6E1ED",
        background: "#F4F1F7",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 34, alignItems: "center" }}>
        {sections.map((s) => (
          <a
            key={s.key}
            href={`#${s.key}`}
            aria-label={s.label}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: active === s.key ? "#DE3A2C" : "#E6E1ED",
              border: "2px solid #fff",
              outline: `2px solid ${active === s.key ? "#DE3A2C" : "#E6E1ED"}`,
              transition: "transform 0.25s ease, background 0.25s ease, outline-color 0.25s ease",
              transform: active === s.key ? "scale(1.5)" : "scale(1)",
              display: "block",
            }}
          />
        ))}
      </div>
    </nav>
  );
}
