"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

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
  const router = useRouter();
  const pathname = usePathname();
  const [activeId, setActiveId] = useState(tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id);

  function activate(id: string) {
    setActiveId(id);
    router.replace(`${pathname}?tab=${id}`, { scroll: false });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    const nextId = tabs[nextIndex].id;
    activate(nextId);
    document.getElementById(`tab-${nextId}`)?.focus();
  }

  return (
    <div>
      <div role="tablist" className="border-b border-black/[0.08]" style={{ marginBottom: 24 }}>
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
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
        <div key={tab.id} id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`} hidden={tab.id !== activeId}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
