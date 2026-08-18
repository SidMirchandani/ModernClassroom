"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, GraduationCap, Loader2, X } from "lucide-react";
import {
  TOUR_STEPS,
  endTour,
  readTourStep,
  writeTourStep,
} from "@/lib/tour";
import { cn } from "@/lib/utils";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** How long to keep looking for a stop's element after navigating to it. */
const FIND_TIMEOUT_MS = 2000;

/**
 * How long the "going to…" state stays up after the last click. Long enough to
 * be read as a move between screens rather than a jump cut.
 */
const TRAVEL_MS = 420;

/** Time for the scroll to settle before a control is lit. */
const SETTLE_MS = 320;

/** How long a control sits lit before the tour presses it. */
const PRESS_DELAY_MS = 400;

/** And how long the result is left alone before the next control lights up. */
const BETWEEN_CLICKS_MS = 650;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Elements can be in the DOM twice — the class tabs render once in the navbar
 * and once in the phone row — so take the one a person could actually click.
 */
function findVisible(anchor: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`)];
  return all.find((el) => el.offsetParent !== null) ?? all[0] ?? null;
}

async function waitForAnchor(anchor: string, alive: () => boolean) {
  const deadline = performance.now() + FIND_TIMEOUT_MS;
  while (performance.now() < deadline) {
    const el = findVisible(anchor);
    if (el) return el;
    if (!alive()) return null;
    await wait(60);
  }
  return null;
}

/**
 * The guided walk through the demo. It is deliberately *not* modal: the page
 * stays live under it, so a stop can say "try one" and mean it. Separation
 * comes from a ring around the thing being described rather than from dimming
 * everything else, which is the same reason popups here blur instead of darken.
 */
export function DemoTour() {
  const router = useRouter();
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [travellingTo, setTravellingTo] = useState<string | null>(null);
  const [press, setPress] = useState<{ box: Box; x: number; y: number } | null>(null);

  useEffect(() => setIndex(readTourStep()), []);

  const step = index === null ? null : TOUR_STEPS[index];

  // Going back does not re-walk the path: the controls that lead forward are
  // on the screen you just left, so there is nothing to press and nothing to
  // watch — Back simply returns.
  const backwardsRef = useRef(false);

  const go = useCallback(
    (next: number) => {
      backwardsRef.current = index !== null && next < index;
      setBox(null);
      setIndex(next);
      writeTourStep(next);
    },
    [index]
  );

  const close = useCallback(() => {
    setIndex(null);
    setBox(null);
    endTour();
  }, []);

  // Each stop names where it happens, and how it is reached: the tour presses
  // the same buttons a person would, one at a time, rather than teleporting.
  // Watching the path is half of what a tour teaches.
  const travelRef = useRef(0);

  useEffect(() => {
    if (!step?.href) return;
    // Read the location directly rather than depending on `pathname`: a route
    // changes it midway, and re-running this effect would restart the walk.
    const { href, place, route } = step;
    if (`${window.location.pathname}${window.location.search}` === href) return;

    const id = ++travelRef.current;
    const alive = () => travelRef.current === id;

    (async () => {
      setTravellingTo(place);

      for (const anchor of backwardsRef.current ? [] : route ?? []) {
        const el = await waitForAnchor(anchor, alive);
        if (!el || !alive()) break;

        el.scrollIntoView({ block: "center", behavior: "smooth" });
        await wait(SETTLE_MS);
        if (!alive()) return;

        const r = el.getBoundingClientRect();
        setPress({
          box: { top: r.top, left: r.left, width: r.width, height: r.height },
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        });
        await wait(PRESS_DELAY_MS);
        if (!alive()) return;

        el.click();
        setPress(null);
        await wait(BETWEEN_CLICKS_MS);
        if (!alive()) return;
      }

      // Whatever happened above, end up where the stop says — a route can miss
      // if the page was left somewhere the tour did not expect.
      if (`${window.location.pathname}${window.location.search}` !== href) {
        router.push(href);
      }
      await wait(TRAVEL_MS);
      if (!alive()) return;
      setTravellingTo(null);
      setPress(null);
    })();

    return () => {
      travelRef.current++;
    };
  }, [step, router]);

  // The page itself steps back while the move is happening, so the change of
  // screen is something you watch rather than something you missed.
  useEffect(() => {
    if (!travellingTo) return;
    document.body.classList.add("tour-moving");
    return () => document.body.classList.remove("tour-moving");
  }, [travellingTo]);

  // The element may not exist yet — the route is still resolving, or the view
  // it lives in has not rendered. Keep looking until it turns up, then track it
  // through scrolling and resizing.
  useEffect(() => {
    if (!step?.anchor || travellingTo) {
      setBox(null);
      return;
    }

    const selector = `[data-tour="${step.anchor}"]`;
    let frame = 0;
    let found: Element | null = null;
    const deadline = performance.now() + FIND_TIMEOUT_MS;

    const measure = () => {
      if (!found) return;
      const r = found.getBoundingClientRect();
      // A stop can point at something taller than the screen — the whole
      // curriculum, the whole table. Ring what is on screen rather than
      // drawing a rectangle whose other edge is a thousand pixels away.
      const top = Math.max(r.top, 8);
      const bottom = Math.min(r.bottom, window.innerHeight - 8);
      setBox({
        top,
        left: r.left,
        width: r.width,
        height: Math.max(bottom - top, 0),
      });
    };

    const hunt = () => {
      found = document.querySelector(selector);
      if (found) {
        // Centring something taller than the viewport lands you in its middle,
        // which for a year of curriculum is Unit 6 — start at its top instead.
        const tall = found.getBoundingClientRect().height > window.innerHeight * 0.75;
        found.scrollIntoView({ block: tall ? "start" : "center", behavior: "smooth" });
        // Follow the smooth scroll frame by frame rather than measuring once
        // after a guessed delay — a single reading taken mid-flight leaves the
        // ring at the position the element was passing through.
        const settle = performance.now() + 900;
        const track = () => {
          measure();
          if (performance.now() < settle) frame = requestAnimationFrame(track);
        };
        track();
        return;
      }
      if (performance.now() < deadline) frame = requestAnimationFrame(hunt);
    };

    hunt();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step, travellingTo]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, close]);

  if (index === null || !step || typeof document === "undefined") return null;

  const last = index === TOUR_STEPS.length - 1;

  // The panel moves out of its own way. Usually that means the other half of
  // the screen from whatever is ringed; when the ring fills the screen
  // top-to-bottom — the table, the curriculum — there is no other half, so it
  // steps sideways instead.
  const fillsHeight = box !== null && box.height > window.innerHeight * 0.6;
  const atTop =
    box !== null && !fillsHeight && box.top + box.height / 2 > window.innerHeight / 2;
  const atLeft =
    box !== null && fillsHeight && box.left + box.width > window.innerWidth - 420;

  return createPortal(
    <>
      {press && (
        <>
          <div
            aria-hidden
            className="fixed z-[290] pointer-events-none rounded-xl ring-2 ring-primary transition-all duration-150"
            style={{
              top: press.box.top - 4,
              left: press.box.left - 4,
              width: press.box.width + 8,
              height: press.box.height + 8,
            }}
          />
          <span
            aria-hidden
            className="fixed z-[290] pointer-events-none w-6 h-6 -ml-3 -mt-3 rounded-full bg-primary/40 tour-tap"
            style={{ top: press.y, left: press.x }}
          />
        </>
      )}

      {box && !press && (
        <div
          aria-hidden
          className="fixed z-[290] pointer-events-none rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-950 transition-all duration-200"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
          }}
        />
      )}

      <div
        role="dialog"
        aria-label="Demo tour"
        className={cn(
          "fixed z-[300] w-[min(92vw,23rem)] rounded-2xl border border-slate-200 dark:border-slate-700 float-pane-raised shadow-z5",
          atTop ? "top-[4.5rem]" : "bottom-5",
          atLeft ? "left-5" : "right-5"
        )}
      >
        <div className="flex items-start gap-3 px-4 pt-4">
          <GraduationCap className="w-5 h-5 shrink-0 mt-0.5 text-primary dark:text-primary-glow" />
          <div className="flex-1 min-w-0">
            <div className="eyebrow-muted">
              Step {index + 1} of {TOUR_STEPS.length} · {step.place}
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug mt-0.5">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="End tour"
            className="shrink-0 w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {travellingTo ? (
          <p className="px-4 pt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary dark:text-primary-glow" />
            Going to the {travellingTo.toLowerCase()}…
          </p>
        ) : (
          <p className="px-4 pt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 animate-content-in">
            {step.body}
          </p>
        )}

        {/* A thin read of how far in you are — a tour with no end in sight is
            one people abandon at step three. */}
        <div className="mx-4 mt-4 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={close}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {last ? "Close" : "Skip tour"}
          </button>
          <div className="flex-1" />
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-primary/50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? close() : go(index + 1))}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors"
          >
            {last ? "Start exploring" : "Next"}
            {!last && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
