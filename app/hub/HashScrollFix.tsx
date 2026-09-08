"use client";

import { useEffect } from "react";

/**
 * Cross-page links such as /hub#fit-checker (used on the persona pages) can land
 * before the anchor target has hydrated, so the browser's initial hash jump
 * misses. After first paint, re-run the scroll once the element is in the DOM.
 */
export default function HashScrollFix() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
