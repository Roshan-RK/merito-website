"use client";

import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";

export type TabDef = {
  id: string;
  label: string;
  content: React.ReactNode;
};

const tabButtonBase: React.CSSProperties = {
  fontSize: 13,
  padding: "10px 4px",
  marginRight: 24,
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  cursor: "pointer",
};

export default function Tabs({ tabs, initialTab }: { tabs: TabDef[]; initialTab: string }) {
  const pathname = usePathname();
  const baseId = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeId, setActiveId] = useState(tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id);

  function activate(id: string) {
    setActiveId(id);
    // Native History API instead of router.replace: updates the URL for
    // deep-linking/reload without triggering a Next.js navigation, which on
    // this dynamic (auth-cookied) route would re-run getCandidateDetail()'s
    // ~8 Supabase queries plus a live IntervueBox HTTP call per lead on
    // every tab click.
    window.history.replaceState(null, "", `${pathname}?tab=${id}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    const nextId = tabs[nextIndex].id;
    activate(nextId);
    tabRefs.current[nextId]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Candidate detail sections" className="border-b border-black/[0.08]" style={{ marginBottom: 24 }}>
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              id={`${baseId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => activate(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="font-[family-name:var(--font-poppins)]"
              style={{
                ...tabButtonBase,
                color: selected ? "#ed1a24" : "#9c9c9c",
                fontWeight: selected ? 600 : 400,
                borderBottomColor: selected ? "#ed1a24" : "transparent",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
