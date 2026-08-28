"use client";

import { useEffect } from "react";

// Closes any open dropdown when a click lands outside every registered
// trigger/panel pair, or when Escape is pressed -- shared by the header
// menus (TopBar) and the RoleSwitcher instead of duplicating the listener.
export function useDismiss(open: boolean, onDismiss: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (refs.every((ref) => ref.current && !ref.current.contains(e.target as Node))) onDismiss();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onDismiss, refs]);
}
