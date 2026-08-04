"use client";

import { useEffect, useRef, useState } from "react";

export default function AnimatedDimensionBars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; max: number; color: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="bg-white border border-black/[0.08]" style={{ borderRadius: 22, padding: "26px 30px", marginBottom: 22 }}>
      <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 11, letterSpacing: "0.1em", margin: "0 0 20px" }}>
        {title}
      </p>
      {rows.map((row) => (
        <div key={row.label} style={{ marginBottom: 16 }}>
          <div className="flex justify-between" style={{ fontSize: 13.5, marginBottom: 6 }}>
            <span className="font-[family-name:var(--font-inter)] font-medium text-black">{row.label}</span>
            <span className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold text-black">
              {row.max === 5 ? row.value.toFixed(1) : `${row.value}%`}
            </span>
          </div>
          <div style={{ height: 8, background: "#F4F1F7", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 6,
                width: inView ? `${(row.value / row.max) * 100}%` : "0%",
                background: row.color,
                transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
