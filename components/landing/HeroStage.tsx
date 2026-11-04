"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const PICTURES = ["/hero-dashboard.jpg", "/hero-screen.jpg", "/hero-curriculum.jpg"];
const HOLD_MS = 5000;

/**
 * The opening panel. It stays pinned while the rest of the page slides up over
 * it like a sheet, easing back a little as it goes, and the real screens crossfade
 * slowly behind the headline. Everything moves by transform and opacity, so it
 * stays smooth, and it stops working once it is fully covered.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const [showing, setShowing] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      if (!document.hidden) setShowing((i) => (i + 1) % PICTURES.length);
    }, HOLD_MS);

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
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={section} className="sticky top-[4.5rem] z-0 px-3 sm:px-6 pb-3">
      <div
        ref={panel}
        className="relative overflow-hidden rounded-3xl bg-slate-950 dark:border dark:border-slate-800 h-[calc(100svh-5.25rem)] min-h-[32rem] flex items-end justify-center px-5 pb-10 sm:pb-16 text-center origin-top will-change-transform"
      >
        {PICTURES.map((src, i) => (
          <div
            key={src}
            aria-hidden
            className={cn(
              "absolute inset-0 transition-opacity duration-[1800ms] ease-in-out",
              i === showing ? "opacity-70" : "opacity-0"
            )}
          >
            <Image src={src} alt="" fill priority={i === 0} sizes="100vw" className="hero-drift object-cover object-top" />
          </div>
        ))}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/10" />
        <div ref={words} className="relative max-w-4xl will-change-transform">
          {children}
        </div>
      </div>
    </section>
  );
}
