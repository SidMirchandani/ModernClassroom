"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { HeroScene } from "./HeroScene";

/**
 * The opening panel. On arrival the logo stands alone in the middle of the screen
 * with the name under it. The name fades, then the logo flies to its place in the
 * scene as everything else arrives (`.hero-intro`, in CSS, so nothing can flash).
 * After that the panel stays pinned while the rest of the page slides up over it,
 * easing back a little as it goes. It stops painting once it is fully covered.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);

  // Arriving part way down the page, the logo has nowhere sensible to be.
  useLayoutEffect(() => {
    if ((window.scrollY > 0 || window.location.hash) && intro.current) {
      intro.current.style.display = "none";
    }
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const paint = () => {
      frame = 0;
      const height = section.current?.offsetHeight ?? 1;
      const progress = Math.min(1, Math.max(0, window.scrollY / height));
      if (panel.current) {
        panel.current.style.transform = `scale(${1 - progress * 0.05})`;
        panel.current.style.visibility = progress >= 1 ? "hidden" : "visible";
      }
      if (words.current) {
        words.current.style.transform = `translateY(${progress * -56}px)`;
        words.current.style.opacity = String(1 - progress * 1.3);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    paint();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={section} className="sticky top-[4.5rem] z-0 px-3 sm:px-6 pb-3">
      <div ref={intro} aria-hidden className="hero-intro">
        <span className="hero-intro-ring" />
        <span className="hero-intro-ring hero-intro-ring-late" />
        {/* Native img, as in Logo.tsx: it must keep its transparency and be there at once. */}
        <img src="/Logo.png" alt="" className="hero-intro-mark" />
        <p className="hero-intro-name">Modern Classroom</p>
      </div>
      <div ref={panel} className="origin-top will-change-transform">
        <div className="hero-panel relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-[calc(100svh-5.25rem)] min-h-[32rem]">
          {/* There from the first moment, behind the logo as well. */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <span className="hs-glow hs-glow-blue" />
            <span className="hs-glow hs-glow-sky" />
            <span className="hs-glow hs-glow-emerald" />
            <span className="hs-glow hs-glow-amber" />
          </div>
          <HeroScene />
          <div className="absolute inset-0 flex flex-col items-center px-5 pb-10 sm:pb-12 text-center">
            <div aria-hidden className="hero-words-gap" />
            <div ref={words} className="relative shrink-0 max-w-2xl will-change-transform">
              {children}
            </div>
            <div aria-hidden className="grow-[9]" />
          </div>
        </div>
      </div>
    </section>
  );
}
