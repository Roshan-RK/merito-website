"use client";

import { useRef, useState, useEffect } from "react";

type Props = {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
};

export default function HubCountUp({ to, prefix = "", suffix = "", duration = 1500 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  // Start at the real value so SSR, no-JS, hydration, and a stats bar that is
  // already on screen at load all show the true number -- never "0+". The
  // count-up animation is a progressive enhancement applied only when the
  // element scrolls into view from below.
  const [val, setVal] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;

    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyVisible) return;

    setVal(0);
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !done) {
            done = true;
            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - t, 3);
              setVal(to * eased);
              if (t < 1) requestAnimationFrame(tick);
              else setVal(to);
            };
            requestAnimationFrame(tick);
            io.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {Math.round(val)}
      <span style={{ color: "#ed1a24" }}>{suffix}</span>
    </span>
  );
}
